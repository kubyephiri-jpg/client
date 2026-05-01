import { db } from '../config/firebase';
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp,
  Timestamp,
  getDoc
} from 'firebase/firestore';

// Order status types
export type OrderStatus = 
  | 'pending'           // Just created, waiting for driver
  | 'accepted'          // Driver accepted
  | 'arriving'          // Driver is on the way to pickup
  | 'arrived'           // Driver arrived at pickup
  | 'in_progress'       // Trip/delivery in progress (NOT 'started')
  | 'completed'         // Order completed
  | 'cancelled';        // Order cancelled

// Service types supported
export type ServiceType = 
  | 'ride' 
  | 'food' 
  | 'clothes' 
  | 'hardware' 
  | 'package' 
  | 'towing' 
  | 'truck';

// Location structure
export interface OrderLocation {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

// Cart item for delivery orders
export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  storeName?: string;
  storeId?: string;
}

// Driver info (populated when driver accepts)
export interface DriverInfo {
  id: string;
  name: string;
  phone: string;
  photo?: string;
  rating?: number;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  licensePlate?: string;
  location?: {
    lat: number;
    lng: number;
  };
}

// Package-specific details
export interface PackageDetails {
  description: string;
  weight?: string;
  size?: string;
  fragile?: boolean;
  recipientName: string;
  recipientPhone: string;
}

// Towing-specific details
export interface TowingDetails {
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear?: string;
  vehicleColor?: string;
  issue?: string;
  licensePlate?: string;
}

// Truck-specific details
export interface TruckDetails {
  loadDescription: string;
  weight?: string;
  helpers?: number;
  floors?: {
    pickup?: number;
    dropoff?: number;
  };
}

// Unified Order structure
export interface Order {
  id?: string;
  userId: string;
  serviceType: ServiceType;
  status: OrderStatus;
  
  // Locations
  pickup: OrderLocation;
  dropoff: OrderLocation;
  stops?: OrderLocation[];
  
  // Vehicle/category selection
  vehicleCategory: string;
  vehicleTitle: string;
  
  // Pricing
  price: number;
  currency: string;
  priceBreakdown?: {
    baseFare: number;
    distance: number;
    time: number;
    surge?: number;
    discount?: number;
    serviceFee?: number;
  };
  
  // Trip info
  estimatedDuration: number; // in minutes
  estimatedDistance?: number; // in km
  
  // Payment
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  
  // Driver (populated when accepted)
  driver?: DriverInfo;
  
  // Service-specific data
  cartItems?: CartItem[];           // For food/clothes/hardware
  packageDetails?: PackageDetails;  // For package delivery
  towingDetails?: TowingDetails;    // For towing
  truckDetails?: TruckDetails;      // For truck/moving
  
  // Promo/discount
  promoCode?: string;
  promoDiscount?: number;
  
  // Timestamps
  createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
  acceptedAt?: Timestamp;
  arrivedAt?: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  cancelledAt?: Timestamp;
  
  // Metadata
  notes?: string;
  rating?: number;
  review?: string;
}

// Input for creating a new order
export interface CreateOrderInput {
  userId: string;
  serviceType: ServiceType;
  pickup: OrderLocation;
  dropoff: OrderLocation;
  stops?: OrderLocation[];
  vehicleCategory: string;
  vehicleTitle: string;
  price: number;
  currency?: string;
  estimatedDuration: number;
  estimatedDistance?: number;
  paymentMethod: string;
  cartItems?: CartItem[];
  packageDetails?: PackageDetails;
  towingDetails?: TowingDetails;
  truckDetails?: TruckDetails;
  promoCode?: string;
  promoDiscount?: number;
  notes?: string;
}

/**
 * Create a new order in the unified orders collection
 */
export async function createOrder(input: CreateOrderInput): Promise<string> {
  const order: Omit<Order, 'id'> = {
    userId: input.userId,
    serviceType: input.serviceType,
    status: 'pending',
    pickup: input.pickup,
    dropoff: input.dropoff,
    stops: input.stops,
    vehicleCategory: input.vehicleCategory,
    vehicleTitle: input.vehicleTitle,
    price: input.price,
    currency: input.currency || 'ZAR',
    estimatedDuration: input.estimatedDuration,
    estimatedDistance: input.estimatedDistance,
    paymentMethod: input.paymentMethod,
    paymentStatus: 'pending',
    cartItems: input.cartItems,
    packageDetails: input.packageDetails,
    towingDetails: input.towingDetails,
    truckDetails: input.truckDetails,
    promoCode: input.promoCode,
    promoDiscount: input.promoDiscount,
    notes: input.notes,
    createdAt: serverTimestamp(),
  };

  // Remove undefined fields
  const cleanOrder = Object.fromEntries(
    Object.entries(order).filter(([, v]) => v !== undefined)
  );

  const docRef = await addDoc(collection(db, 'orders'), cleanOrder);
  return docRef.id;
}

/**
 * Get an order by ID
 */
export async function getOrder(orderId: string): Promise<Order | null> {
  const docRef = doc(db, 'orders', orderId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return { id: docSnap.id, ...docSnap.data() } as Order;
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: string, 
  status: OrderStatus,
  additionalData?: Partial<Order>
): Promise<void> {
  const docRef = doc(db, 'orders', orderId);
  const updateData: Record<string, unknown> = { status, ...additionalData };
  
  // Add timestamp for status changes
  const timestampMap: Record<string, string> = {
    'accepted': 'acceptedAt',
    'arrived': 'arrivedAt',
    'in_progress': 'startedAt',
    'completed': 'completedAt',
    'cancelled': 'cancelledAt',
  };
  
  if (timestampMap[status]) {
    updateData[timestampMap[status]] = serverTimestamp();
  }
  
  await updateDoc(docRef, updateData);
}

/**
 * Cancel an order
 */
export async function cancelOrder(orderId: string, reason?: string): Promise<void> {
  await updateOrderStatus(orderId, 'cancelled', { 
    cancellationReason: reason 
  } as Partial<Order>);
}

/**
 * Subscribe to order updates
 */
export function subscribeToOrder(
  orderId: string,
  callback: (order: Order | null) => void
): () => void {
  const docRef = doc(db, 'orders', orderId);
  
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as Order);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('Error listening to order:', error);
    callback(null);
  });
}

/**
 * Update driver location in order
 */
export async function updateDriverLocation(
  orderId: string,
  location: { lat: number; lng: number }
): Promise<void> {
  const docRef = doc(db, 'orders', orderId);
  await updateDoc(docRef, {
    'driver.location': location
  });
}

/**
 * Helper to get display text for status
 */
export function getStatusDisplayText(status: OrderStatus, serviceType: ServiceType): string {
  const isDelivery = ['food', 'clothes', 'hardware', 'package'].includes(serviceType);
  const isTowing = serviceType === 'towing';
  const isTruck = serviceType === 'truck';
  
  const statusText: Record<OrderStatus, string> = {
    'pending': isDelivery ? 'Finding courier...' : isTowing ? 'Finding tow truck...' : isTruck ? 'Finding truck...' : 'Finding driver...',
    'accepted': isDelivery ? 'Courier accepted' : isTowing ? 'Tow truck assigned' : isTruck ? 'Truck assigned' : 'Driver accepted',
    'arriving': isDelivery ? 'Courier on the way' : isTowing ? 'Tow truck on the way' : isTruck ? 'Truck on the way' : 'Driver on the way',
    'arrived': isDelivery ? 'Courier arrived' : isTowing ? 'Tow truck arrived' : isTruck ? 'Truck arrived' : 'Driver arrived',
    'in_progress': isDelivery ? 'Delivery in progress' : isTowing ? 'Towing in progress' : isTruck ? 'Moving in progress' : 'Trip in progress',
    'completed': isDelivery ? 'Delivered' : isTowing ? 'Towing complete' : isTruck ? 'Moving complete' : 'Trip completed',
    'cancelled': 'Cancelled',
  };
  
  return statusText[status];
}
