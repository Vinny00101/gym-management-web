import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca uma rota que não exige token de acesso. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
