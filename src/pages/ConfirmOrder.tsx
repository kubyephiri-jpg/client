import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users } from 'lucide-react';
import { MapBackground } from '../components/MapBackground';
import { useUserProfile } from '../hooks/useUserProfile';
import { useRideContext } from '../contexts/RideContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../config/firebase';
import { 
  createOrder, 
  ServiceType,
  CreateOrderInput 
} from '../services/orderService';

interface UserLocation {
  lat: number | null;
  lng: number | null;
}

interface RideData {
  pricingId: string;
  name: string;
  estimatedPrice: number;
  originalPrice: number;
  eta: string;
  vehicleCategory: string;
  seats: number;
}

interface ConfirmOrderProps {
  destination: string;
  pickup: string;
  stops: string[];
  carType: string;
  price: number;
  onBack: () => void;
  onRideConfirmed: () => void;
  onRideCreated: (rideId: string) => void;
}

export const ConfirmOrder: React.FC<ConfirmOrderProps> = ({
  destination,
  pickup,
  stops,
  carType,
  price,
  onBack,
  onRideConfirmed,
  onRideCreated,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation>({ lat: null, lng: null });
  const { profile } = useUserProfile();
  const { isRideActive } = useRideContext();

  // Get user's GPS location on component mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting user location:', error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  }, []);

  const {
    orderType = 'ride',
    type = '',
    orderData = {},
    serviceType,
    vehicle,
    extraSelection,
    pickupAddress,
    destinationAddress,
    rideData,
    pickupCoords,
    destinationCoords
  } = location.state || {};

  const isDelivery = orderType === 'delivery';
  const isFood = orderType === 'food';
  const isRide = orderType === 'ride' && rideData;

  const isDeliveryOrFood = isDelivery || isFood;
  const finalDestination = isRide ? destinationAddress : (isDeliveryOrFood ? orderData.destinationAddress : destination);
  const finalPickup = isRide ? pickupAddress : (isDeliveryOrFood ? (orderData.storeAddress || orderData.pickupAddress) : pickup);
  const finalStops = isDeliveryOrFood ? (orderData.stops || []) : stops;

  const isService = serviceType && serviceType !== 'ride';

  const getServiceLabel = () => {
    if (serviceType === 'package') return 'Package Delivery';
    if (serviceType === 'towing') return 'Towing Service';
    if (serviceType === 'truck') return 'Truck Service';
    return '';
  };

  const getExtraSelectionLabel = () => {
    if (serviceType === 'package') return 'Weight';
    if (serviceType === 'towing') return 'Vehicle Type';
    if (serviceType === 'truck') return 'Cargo Type';
    return '';
  };

  /**
   * Unified order creation for all service types
   * Uses the new orders collection via orderService
   */
  const createUnifiedOrder = async (): Promise<string> => {
    const currentUser = auth.currentUser;
    const userId = currentUser?.uid || profile?.id || 'guest';

    // Determine service type
    let svcType: ServiceType = 'ride';
    if (serviceType === 'package') svcType = 'package';
    else if (serviceType === 'towing') svcType = 'towing';
    else if (serviceType === 'truck') svcType = 'truck';
    else if (isDelivery || isFood) svcType = (type as ServiceType) || 'food';

    // Build order input
    const orderInput: CreateOrderInput = {
      userId,
      serviceType: svcType,
      pickup: {
        address: finalPickup || pickupAddress || '',
        lat: pickupCoords?.lat || userLocation.lat || 0,
        lng: pickupCoords?.lng || userLocation.lng || 0,
      },
      dropoff: {
        address: finalDestination || destinationAddress || '',
        lat: destinationCoords?.lat || 0,
        lng: destinationCoords?.lng || 0,
      },
      stops: (finalStops || []).map((stop: string) => ({
        address: stop,
        lat: 0,
        lng: 0,
      })),
      vehicleCategory: isRide ? rideData.vehicleCategory : (vehicle?.id || vehicle?.name || orderData.deliveryMode?.id || ''),
      vehicleTitle: isRide ? rideData.name : (vehicle?.name || orderData.deliveryMode?.label || ''),
      price: isRide ? rideData.estimatedPrice : (vehicle?.price || orderData.totalPrice || 0),
      currency: 'ZAR',
      estimatedDuration: isRide 
        ? parseInt(rideData.eta?.replace(' min', '') || '10') 
        : (parseInt(orderData.deliveryMode?.time) || vehicle?.eta || 20),
      paymentMethod: 'cash',
    };

    // Add service-specific data
    if (isDelivery || isFood) {
      const cleanItems = (orderData.items || []).map((item: any) => ({
        id: item.id || '',
        name: item.name || '',
        price: item.price || 0,
        quantity: item.quantity || 1,
        image: item.image || '',
        storeName: orderData.storeName || '',
        storeId: orderData.storeId || '',
      }));
      orderInput.cartItems = cleanItems;
    }

    if (serviceType === 'package') {
      orderInput.packageDetails = {
        description: extraSelection || '',
        weight: extraSelection || '',
        recipientName: '',
        recipientPhone: '',
      };
    }

    if (serviceType === 'towing') {
      orderInput.towingDetails = {
        vehicleMake: extraSelection || '',
        vehicleModel: '',
        issue: '',
      };
    }

    if (serviceType === 'truck') {
      orderInput.truckDetails = {
        loadDescription: extraSelection || '',
      };
    }

    // Create the order
    const orderId = await createOrder(orderInput);
    return orderId;
  };

  const handleConfirmOrder = async () => {
    if (isLoading || isRideActive) {
      if (isRideActive) {
        alert('You already have an active order.');
      }
      return;
    }

    setIsLoading(true);

    try {
      // Use unified order creation for all service types
      const orderId = await createUnifiedOrder();

      // Store order ID and type in localStorage
      localStorage.setItem('currentOrderId', orderId);
      localStorage.setItem('currentOrderType', isService ? serviceType : (isDelivery || isFood ? (type || 'food') : 'ride'));

      // Notify parent component
      if (onRideCreated) {
        onRideCreated(orderId);
      }

      // Determine navigation destination
      const isDeliveryType = isDelivery || isFood;
      const navigateTo = isDeliveryType ? '/order-tracking' : '/waiting-for-driver';

      navigate(navigateTo, {
        state: {
          orderId,
          orderType: isService ? serviceType : (isDeliveryType ? (type || 'food') : 'ride'),
          orderData: {
            pickup: finalPickup || pickupAddress,
            destination: finalDestination || destinationAddress,
            stops: finalStops,
            vehicleCategory: isRide ? rideData?.vehicleCategory : (vehicle?.id || vehicle?.name || orderData.deliveryMode?.id),
            vehicleTitle: isRide ? rideData?.name : (vehicle?.name || orderData.deliveryMode?.label),
            price: isRide ? rideData?.estimatedPrice : (vehicle?.price || orderData.totalPrice),
            eta: isRide ? rideData?.eta : (vehicle?.eta || orderData.deliveryMode?.time),
            status: 'pending'
          }
        }
      });
    } catch (error) {
      console.error('Failed to create order:', error);
      alert('Failed to create order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <MapBackground />

      <AnimatePresence>
        {!isLoading && (
          <motion.div
            className="absolute top-0 left-0 right-0 z-10 p-4"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            transition={{ delay: 0.1 }}
          >
            <button
              onClick={onBack}
              className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-800" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="absolute top-24 left-1/2 transform -translate-x-1/2 z-10"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="bg-[#5B2EFF] text-white px-6 py-3 rounded-full shadow-lg">
          <div className="text-center">
            <div className="text-2xl font-bold">
              {isRide ? rideData?.eta?.replace(' min', '') || '2' : '2'}
            </div>
            <div className="text-sm">min</div>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl p-6 z-20 max-h-[80vh] overflow-y-auto"
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 200, delay: 0.2 }}
      >
        <div className="space-y-6">
          {isService ? (
            <>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{getServiceLabel()}</h2>
                <p className="text-gray-600">{vehicle?.description}</p>
                <p className="text-sm text-gray-500">{vehicle?.eta}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Service Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pickup:</span>
                    <span className="text-gray-900 font-medium">{pickupAddress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Destination:</span>
                    <span className="text-gray-900 font-medium">{destinationAddress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Vehicle:</span>
                    <span className="text-gray-900 font-medium">{vehicle?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{getExtraSelectionLabel()}:</span>
                    <span className="text-gray-900 font-medium">{extraSelection}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 mb-3">Pricing</h3>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-gray-900">R {vehicle?.price || 0}</span>
                </div>
              </div>
            </>
          ) : isDelivery ? (
            <>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{orderData.deliveryMode?.label}</h2>
                <p className="text-gray-600">{orderData.deliveryMode?.description}</p>
                <p className="text-sm text-gray-500">{orderData.deliveryMode?.time}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Delivery Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">From:</span>
                    <span className="text-gray-900 font-medium text-right max-w-[200px] truncate">
                      {orderData.storeAddress || orderData.storeName || 'Store'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">To:</span>
                    <span className="text-gray-900 font-medium text-right max-w-[200px] truncate">
                      {orderData.destinationAddress}
                    </span>
                  </div>
                  {orderData.stops && orderData.stops.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Stops:</span>
                      <span className="text-gray-900 font-medium">{orderData.stops.length}</span>
                    </div>
                  )}
                </div>
              </div>

              {orderData.items && orderData.items.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Items ({orderData.items.length})</h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {orderData.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-700">{item.name}</span>
                        <span className="font-medium text-gray-900">R {item.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 mb-3">Payment Summary</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium text-gray-900">R {orderData.subtotal || orderData.foodSubtotal || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Delivery fee</span>
                  <span className="font-medium text-gray-900">R {orderData.deliveryFee}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-gray-900">R {orderData.totalPrice}</span>
                </div>
              </div>
            </>
          ) : isFood ? (
            <>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{orderData.deliveryMode?.label}</h2>
                <p className="text-gray-600">{orderData.deliveryMode?.description}</p>
                <p className="text-sm text-gray-500">{orderData.deliveryMode?.time}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Delivery Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">From:</span>
                    <span className="text-gray-900 font-medium">{orderData.pickupAddress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">To:</span>
                    <span className="text-gray-900 font-medium">{orderData.destinationAddress}</span>
                  </div>
                  {orderData.stops && orderData.stops.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Stops:</span>
                      <span className="text-gray-900 font-medium">{orderData.stops.length}</span>
                    </div>
                  )}
                </div>
              </div>

              {orderData.items && orderData.items.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Food Items</h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {orderData.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-700">{item.name}</span>
                        <span className="font-medium text-gray-900">R {item.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 mb-3">Payment Summary</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Food subtotal</span>
                  <span className="font-medium text-gray-900">R {orderData.foodSubtotal}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Delivery fee</span>
                  <span className="font-medium text-gray-900">R {orderData.deliveryFee}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-gray-900">R {orderData.totalPrice}</span>
                </div>
              </div>
            </>
          ) : isRide && rideData ? (
            // New ride confirmation display
            <>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{rideData.name}</h2>
                <p className="text-gray-600">{rideData.eta} away</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Trip Details</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 bg-[#5B2EFF] rounded-full mt-1 flex-shrink-0"></div>
                    <div>
                      <span className="text-gray-500 text-xs">Pickup</span>
                      <p className="text-gray-900 font-medium">{finalPickup}</p>
                    </div>
                  </div>
                  {finalStops.length > 0 && finalStops.map((stop: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 ml-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 flex-shrink-0"></div>
                      <div>
                        <span className="text-gray-500 text-xs">Stop {idx + 1}</span>
                        <p className="text-gray-900 font-medium">{stop}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 bg-blue-600 rounded-full mt-1 flex-shrink-0"></div>
                    <div>
                      <span className="text-gray-500 text-xs">Destination</span>
                      <p className="text-gray-900 font-medium">{finalDestination}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Ride Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ride Type</span>
                    <span className="text-gray-900 font-medium">{rideData.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Passengers</span>
                    <div className="flex items-center gap-1">
                      <Users size={14} className="text-gray-500" />
                      <span className="text-gray-900 font-medium">{rideData.seats}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 mb-3">Payment Summary</h3>
                {rideData.originalPrice !== rideData.estimatedPrice && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Original fare</span>
                    <span className="font-medium text-gray-500 line-through">R {rideData.originalPrice}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discounted fare</span>
                  <span className="font-medium text-[#5B2EFF]">30% off</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-gray-900">R {rideData.estimatedPrice}</span>
                </div>
              </div>
            </>
          ) : (
            // Fallback display
            <>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">{finalDestination}</h2>
                <div className="flex items-center justify-center space-x-4 mt-4">
                  <span className="text-lg font-medium text-gray-700">{carType}</span>
                  <span className="text-2xl font-bold text-gray-900">R {price}</span>
                </div>
              </div>
            </>
          )}

          <motion.button
            onClick={handleConfirmOrder}
            disabled={isLoading || isRideActive}
            className={`w-full py-4 rounded-xl font-semibold text-lg shadow-lg transition-colors
              ${isLoading || isRideActive ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#5B2EFF] text-white hover:bg-[#4A24D9]'}`}
            whileTap={{ scale: 0.98 }}
            whileHover={{ scale: isLoading || isRideActive ? 1 : 1.02 }}
          >
            {isLoading ? 'Processing...' : isRideActive ? 'Order Active' : 'Confirm order'}
          </motion.button>
          {isRideActive && (
            <p className="text-gray-500 text-center text-sm mt-2">
              You have an active order
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};
