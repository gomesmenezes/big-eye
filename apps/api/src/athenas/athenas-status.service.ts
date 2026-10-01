import { BadGatewayException, Injectable } from '@nestjs/common';

import {
  AthenasStatusResponseDTO,
  ERROR_CODES,
  type AthenasStatusResponseDTOType,
} from '@big-eye/contracts';
import { getAthenasStatus } from '@big-eye/core/provider/registry';

@Injectable()
export class AthenasStatusService {
  async getStatus(): Promise<AthenasStatusResponseDTOType> {
    try {
      const payload = await getAthenasStatus();
      const result = AthenasStatusResponseDTO.safeParse(payload);
      if (!result.success) {
        throw new BadGatewayException({ code: ERROR_CODES.PROVIDER_UNAVAILABLE });
      }

      return result.data;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException({ code: ERROR_CODES.PROVIDER_UNAVAILABLE });
    }
  }
}
