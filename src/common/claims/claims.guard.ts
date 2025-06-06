import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Claim } from './claim.enum';

@Injectable()
export class ClaimsGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

  matchRoles(authorizations: any[], permission: string) {
    return authorizations.some((role) => permission.includes(role));
  }

  canActivate(context: ExecutionContext): boolean {
    const requirePermissions = this.reflector.getAllAndOverride<Claim[]>(
      'claims',
      [context.getHandler(), context.getClass()],
    );

    if (!requirePermissions) return true;
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    return true
    // return this.matchRoles(requirePermissions, user.permission);
  
  } 
}
