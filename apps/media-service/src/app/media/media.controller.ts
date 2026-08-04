import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  ConfirmMediaUpload,
  LinkMediaRequest,
  MediaPresignRequest,
} from '@nexatech/shared-contracts';
import { MediaService, parseActor, parseRolesHeader } from './media.service';

@ApiTags('media')
@Controller({ path: 'media', version: ['1', '2'] })
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('presign')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Presign upload (authenticated)' })
  presign(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-roles') rolesHeader: string,
    @Body() body: MediaPresignRequest,
  ) {
    return this.mediaService.presignUpload(
      body,
      parseActor(userId, rolesHeader),
    );
  }

  @Get('by-entity/:entityType/:entityId')
  @ApiOperation({ summary: 'List media by entity (public browse)' })
  byEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.mediaService.listByEntity(entityType, entityId);
  }

  @Post('admin/cleanup-orphans')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Admin orphan cleanup (Bearer or gateway trust headers)',
  })
  cleanupOrphans(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-roles') rolesHeader: string,
    @Query('olderThanHours') olderThanHours?: string,
  ) {
    const hours = olderThanHours ? Number(olderThanHours) : 24;
    return this.mediaService.cleanupOrphans(
      Number.isFinite(hours) ? hours : 24,
      parseActor(userId, rolesHeader),
    );
  }

  @Post(':id/confirm')
  @ApiBearerAuth('bearer')
  confirm(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-roles') rolesHeader: string,
    @Param('id') id: string,
    @Body() body: ConfirmMediaUpload,
  ) {
    return this.mediaService.confirmUpload(
      id,
      body,
      parseActor(userId, rolesHeader),
    );
  }

  @Get(':id/download-url')
  @ApiBearerAuth('bearer')
  downloadUrl(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-roles') rolesHeader: string,
    @Param('id') id: string,
  ) {
    return this.mediaService.getDownloadUrl(
      id,
      parseActor(userId, rolesHeader),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Media metadata (public)' })
  metadata(@Param('id') id: string) {
    return this.mediaService.getMetadata(id);
  }

  @Delete(':id')
  @ApiBearerAuth('bearer')
  deleteMedia(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-roles') rolesHeader: string,
    @Param('id') id: string,
  ) {
    return this.mediaService.deleteMedia(id, parseActor(userId, rolesHeader));
  }

  @Post(':id/links')
  @ApiBearerAuth('bearer')
  linkMedia(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-roles') rolesHeader: string,
    @Param('id') id: string,
    @Body() body: LinkMediaRequest,
  ) {
    return this.mediaService.linkMedia(
      id,
      body,
      parseActor(userId, rolesHeader),
    );
  }
}

export { parseRolesHeader };
