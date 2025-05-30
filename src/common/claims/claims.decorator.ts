import { SetMetadata } from '@nestjs/common';
import { Claim } from './claim.enum';

export const Claims = (...claims: Claim[]) => SetMetadata('claims', claims);
