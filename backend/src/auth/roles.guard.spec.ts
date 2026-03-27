import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const mockReflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const createContext = (role?: 'user' | 'admin'): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { role } : {} }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows access when no roles are required', () => {
    mockReflector.getAllAndOverride = jest.fn().mockReturnValue(undefined);
    const guard = new RolesGuard(mockReflector);

    expect(guard.canActivate(createContext('user'))).toBe(true);
  });

  it('allows admin for admin-only routes', () => {
    mockReflector.getAllAndOverride = jest.fn().mockReturnValue(['admin']);
    const guard = new RolesGuard(mockReflector);

    expect(guard.canActivate(createContext('admin'))).toBe(true);
  });

  it('rejects non-admin for admin-only routes', () => {
    mockReflector.getAllAndOverride = jest.fn().mockReturnValue(['admin']);
    const guard = new RolesGuard(mockReflector);

    expect(() => guard.canActivate(createContext('user'))).toThrow(
      'Admin access required',
    );
  });
});
