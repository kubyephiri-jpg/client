// Unified Vehicle Configuration System
// Maps vehicle categories to UI display properties

export interface VehicleConfigItem {
  label: string;
  image: string;
}

// Backend response type for ride options
export interface BackendRideOption {
  category: string;
  title: string;
  enabled: boolean;
  eta: number;
  price: number;
  seats: number;
  image: string;
}

// Single source of truth for all vehicle types
export const VEHICLE_CONFIG: Record<string, VehicleConfigItem> = {
  // Ride vehicles
  ride_economy: { label: 'Economy', image: '/cars/economy.png' },
  ride_comfort: { label: 'Comfort', image: '/cars/comfort.png' },
  ride_premium: { label: 'Premium', image: '/cars/premium.png' },
  ride_aletwende: { label: 'Aletwende', image: '/cars/aletwende.png' },
  ride_xl: { label: 'XL', image: '/cars/xl.png' },
  ride_xxl: { label: 'XXL', image: '/cars/xxl.png' },
  ride_women: { label: 'Women', image: '/cars/xxl.png' },
  
  // Delivery vehicles
  delivery_bicycle: { label: 'Bicycle', image: '/cars/bicycle.png' },
  delivery_motorbike: { label: 'Motorbike', image: '/cars/motorbike.png' },
  delivery_car: { label: 'Delivery Car', image: '/cars/economy.png' },
  delivery_bakkie: { label: 'Bakkie', image: '/cars/bakkie.png' },
  delivery_van: { label: 'Van', image: '/cars/van.png' },
  delivery_truck: { label: 'Truck', image: '/cars/truck.png' },
  delivery_truck_closed: { label: 'Closed Truck', image: '/cars/truck.png' },
  delivery_truck_flatbed: { label: 'Flatbed Truck', image: '/cars/truck.png' },
  delivery_truck_refrigerated: { label: 'Refrigerated Truck', image: '/cars/truck.png' },
  
  // Towing vehicles
  towing: { label: 'Towing', image: '/cars/towing.png' },
  towing_flatbed: { label: 'Flatbed Tow', image: '/cars/towing.png' },
  towing_wheel_lift: { label: 'Wheel Lift', image: '/cars/towing.png' },
  
  // Legacy mappings (for backward compatibility)
  economy: { label: 'Economy', image: '/cars/economy.png' },
  comfort: { label: 'Comfort', image: '/cars/comfort.png' },
  premium: { label: 'Premium', image: '/cars/premium.png' },
  aletwende: { label: 'Aletwende', image: '/cars/aletwende.png' },
  xl: { label: 'XL', image: '/cars/xl.png' },
  xxl: { label: 'XXL', image: '/cars/xxl.png' },
  women: { label: 'Women', image: '/cars/xxl.png' },
  bicycle: { label: 'Bicycle', image: '/cars/bicycle.png' },
  motorbike: { label: 'Motorbike', image: '/cars/motorbike.png' },
  car: { label: 'Car', image: '/cars/economy.png' },
  bakkie: { label: 'Bakkie', image: '/cars/bakkie.png' },
  van: { label: 'Van', image: '/cars/van.png' },
  truck: { label: 'Truck', image: '/cars/truck.png' },
};

// Service to vehicle category mapping
// Defines which vehicle categories are valid for each service type
export const SERVICE_VEHICLE_MAP: Record<string, string[]> = {
  // Ride service - personal transport
  ride: [
    'ride_economy',
    'ride_comfort', 
    'ride_premium',
    'ride_aletwende',
    'ride_xl',
    'ride_xxl',
    'ride_women',
    // Legacy support
    'economy',
    'comfort',
    'premium',
    'aletwende',
    'xl',
    'xxl',
    'women',
  ],

  // Courier service - food, clothes, packages (used by foodies, clothes, send my package paths)
  courier: [
    'delivery_car',
    'delivery_motorbike',
    'delivery_bicycle',
    // Legacy support
    'car',
    'motorbike',
    'bicycle',
  ],

  // Delivery service - hardware/heavy items (used by hardware path)
  delivery: [
    'delivery_truck',
    'delivery_car',
    'delivery_motorbike',
    'delivery_bicycle',
    'delivery_bakkie',
    'delivery_van',
    // Legacy support
    'truck',
    'car',
    'motorbike',
    'bicycle',
    'bakkie',
    'van',
  ],

  // Delivery truck service - truck variants only
  delivery_truck: [
    'delivery_truck',
    'delivery_truck_closed',
    'delivery_truck_flatbed',
    'delivery_truck_refrigerated',
    // Legacy support
    'truck',
  ],

  // Towing service - towing vehicles only
  towing: [
    'towing',
    'towing_flatbed',
    'towing_wheel_lift',
  ],
};

/**
 * Filter backend ride options by service type
 * Only returns options whose category is allowed for the given service
 */
export const filterOptionsByService = (
  options: BackendRideOption[],
  serviceType: string
): BackendRideOption[] => {
  const allowed = SERVICE_VEHICLE_MAP[serviceType] || [];
  
  // If no mapping exists for this service type, return all options
  if (allowed.length === 0) {
    return options;
  }
  
  return options.filter(opt => allowed.includes(opt.category));
};

/**
 * Get vehicle config for a given category
 * Falls back to economy if category not found
 */
export const getVehicleConfig = (category: string): VehicleConfigItem => {
  return VEHICLE_CONFIG[category] || VEHICLE_CONFIG['economy'] || {
    label: category,
    image: '/cars/economy.png',
  };
};
