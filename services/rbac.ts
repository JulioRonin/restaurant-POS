import { Employee } from '../types';

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  WAITER: 'waiter',
  KITCHEN: 'kitchen',
  CHEF: 'chef',
  BAR: 'bar',
  HOSTESS: 'hostess'
} as const;

export type AppRole = typeof ROLES[keyof typeof ROLES];

// Mapping roles to allowed paths
export const ROLE_PERMISSIONS: Record<AppRole, string[]> = {
  [ROLES.ADMIN]: [
    '/dashboard',
    '/pos',
    '/remote-order',
    '/hostess',
    '/cashier',
    '/kitchen',
    '/menu',
    '/inventory',
    '/staff',
    '/billing',
    '/settings',
    '/onboarding',
    '/super-admin',
    '/my-tables'
  ],
  [ROLES.MANAGER]: [
    '/pos',
    '/remote-order',
    '/hostess',
    '/cashier',
    '/kitchen',
    '/menu',
    '/inventory',
    '/billing'
  ],
  [ROLES.CASHIER]: [
    '/cashier',
    '/hostess'
  ],
  [ROLES.HOSTESS]: [
    '/hostess',
    '/pos'
  ],
  [ROLES.WAITER]: [
    '/pos',
    '/bar',
    '/my-tables'
  ],
  [ROLES.KITCHEN]: [
    '/kitchen'
  ],
  [ROLES.CHEF]: [
    '/pos',
    '/kitchen',
    '/bar',
    '/inventory',
    '/my-tables'
  ],
  [ROLES.BAR]: [
    '/bar'
  ]
};

/**
 * Normalizes a role string to match the internal AppRole keys.
 * Handles common Spanish variations and complex titles.
 */
export const normalizeRole = (role: string | undefined): AppRole | undefined => {
  if (!role) return undefined;
  
  const r = role.toLowerCase().trim();
  
  // 1. Direct matching for efficiency
  const directMapping: Record<string, AppRole> = {
    'mesero': ROLES.WAITER,
    'cajero': ROLES.CASHIER,
    'gerente': ROLES.MANAGER,
    'administrador': ROLES.ADMIN,
    'admin': ROLES.ADMIN,
    'cocina': ROLES.KITCHEN,
    'chef': ROLES.CHEF,
    'bar': ROLES.BAR,
    'hostess': ROLES.HOSTESS,
    'servicio': ROLES.WAITER,
    'mesera': ROLES.WAITER
  };

  if (directMapping[r]) return directMapping[r];

  // 2. Keyword detection for complex titles (e.g., 'Chef Principal', 'Mesero de Barra')
  if (r.includes('chef')) return ROLES.CHEF;
  if (r.includes('admin') || r.includes('gerente')) return ROLES.ADMIN;
  if (r.includes('meser') || r.includes('servici')) return ROLES.WAITER;
  if (r.includes('cajer')) return ROLES.CASHIER;
  if (r.includes('cocin')) return ROLES.KITCHEN;
  if (r.includes('bar')) return ROLES.BAR;

  return Object.values(ROLES).includes(r as any) ? r as AppRole : undefined;
};

/**
 * Checks if a specific role is allowed to access a path.
 * Handles exact matches or startsWith for sub-routes.
 */
export const canAccess = (employeeOrRole: Employee | string | undefined, path: string): boolean => {
  if (!employeeOrRole) return false;
  
  let role: string | undefined;
  let allowedModules: string[] | undefined;
  
  if (typeof employeeOrRole === 'string') {
    role = employeeOrRole;
  } else {
    role = employeeOrRole.role;
    allowedModules = employeeOrRole.modules;
  }

  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return false;

  // Admin bypass - admins can access everything, unless they have specific modules configured?
  // User request: "desde el perfil del administrador solamanete ese perfil peuede crear y editar este tipo de funciones"
  // It means the admin edits the modules. If an admin edits someone's modules, it applies to them. 
  // What if an admin restricts an admin? We'll assume admin bypass stays unless specific modules are set.
  if (normalizedRole === ROLES.ADMIN && (!allowedModules || allowedModules.length === 0)) return true;
  
  if (allowedModules && allowedModules.length > 0) {
    return allowedModules.some(allowedPath => path === allowedPath || path.startsWith(`${allowedPath}/`));
  }

  const allowedPaths = ROLE_PERMISSIONS[normalizedRole] || [];
  
  // Exact match or sub-path check
  return allowedPaths.some(allowedPath => 
    path === allowedPath || path.startsWith(`${allowedPath}/`)
  );
};

/**
 * Returns the default "landing page" for each role after unlock.
 */
export const getDefaultRoute = (employeeOrRole: Employee | string | undefined): string => {
  if (!employeeOrRole) return '/';

  let role: string | undefined;
  let allowedModules: string[] | undefined;
  
  if (typeof employeeOrRole === 'string') {
    role = employeeOrRole;
  } else {
    role = employeeOrRole.role;
    allowedModules = employeeOrRole.modules;
  }

  if (allowedModules && allowedModules.length > 0) {
    // If specific modules are assigned, route to the first one available
    return allowedModules[0];
  }

  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return '/';
  
  switch (normalizedRole) {
    case ROLES.ADMIN: return '/dashboard';
    case ROLES.MANAGER: return '/pos';
    case ROLES.CASHIER: return '/cashier';
    case ROLES.HOSTESS: return '/hostess';
    case ROLES.WAITER: return '/pos';
    case ROLES.KITCHEN: return '/kitchen';
    case ROLES.CHEF: return '/kitchen';
    case ROLES.BAR: return '/bar';
    default: return '/';
  }
};
