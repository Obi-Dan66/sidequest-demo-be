import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginationMeta } from '../responses/api-response';

/**
 * Swagger helper to document paginated responses consistently.
 *
 *   @ApiPaginatedResponse(QuestDto) listQuests(...) {}
 */
export function ApiPaginatedResponse<TModel extends Type<unknown>>(model: TModel) {
  return applyDecorators(
    ApiExtraModels(PaginationMeta, model),
    ApiOkResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(model) },
          },
          meta: {
            type: 'object',
            properties: {
              pagination: { $ref: getSchemaPath(PaginationMeta) },
            },
          },
        },
      },
    }),
  );
}
