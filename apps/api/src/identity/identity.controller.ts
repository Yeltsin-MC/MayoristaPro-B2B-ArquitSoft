import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { IncomingMessage, ServerResponse } from 'node:http';
import { browserToken, sameOrigin, sessionCookie } from './browser-session';
import { IdentityService } from './identity.service';
@Controller()
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}
  @Post('auth/register') register(@Body() body: any) {
    return this.identity.register(body ?? {});
  }
  @Post('auth/login')
  async login(
    @Body() body: any,
    @Req() request: IncomingMessage,
    @Res({ passthrough: true }) response: ServerResponse,
  ) {
    sameOrigin(request);
    const result = await this.identity.login(body ?? {});
    sessionCookie(response, request, result.token);
    return result;
  }
  @Get('auth/restore')
  @Header('Cache-Control', 'no-store')
  async restore(@Req() request: IncomingMessage, @Res({ passthrough: true }) response: ServerResponse) {
    sameOrigin(request);
    const token = browserToken(request.headers.cookie);
    try {
      const auth = token ? 'Bearer ' + token : undefined;
      const account = await this.identity.session(auth);
      const membership = account.platformAdmin ? {} : await this.identity.me(auth);
      return { ...account, ...membership, token };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException)
        sessionCookie(response, request);
      throw error;
    }
  }
  @Post('auth/logout')
  async logout(
    @Req() request: IncomingMessage,
    @Res({ passthrough: true }) response: ServerResponse,
    @Headers('authorization') auth?: string,
  ) {
    sameOrigin(request);
    const token = browserToken(request.headers.cookie);
    try {
      return await this.identity.logout(auth ?? (token ? 'Bearer ' + token : undefined));
    } finally {
      sessionCookie(response, request);
    }
  }
  @Get('auth/me') me(@Headers('authorization') auth?: string) {
    return this.identity.me(auth);
  }
  @Get('auth/session') session(@Headers('authorization') auth?: string) {
    return this.identity.session(auth);
  }
  @Get('admin/enrollments') requests(@Headers('authorization') auth?: string) {
    return this.identity.requests(auth);
  }
  @Post('admin/enrollments/:id/approve') approve(@Param('id') id: string, @Headers('authorization') auth?: string) {
    return this.identity.approve(id, auth);
  }
  @Post('company/invitations') invite(@Body() body: any, @Headers('authorization') auth?: string) {
    return this.identity.invite(body ?? {}, auth);
  }
  @Post('auth/invitations/accept') accept(@Body() body: any) {
    return this.identity.accept(body ?? {});
  }
  @Get('company/members') members(@Headers('authorization') auth?: string) {
    return this.identity.members(auth);
  }
  @Post('company/members/:id/revoke') revoke(@Param('id') id: string, @Headers('authorization') auth?: string) {
    return this.identity.revoke(id, auth);
  }
  @Patch('providers/:id/verify') verify(@Param('id') id: string, @Headers('authorization') auth?: string) {
    return this.identity.verify(id, auth);
  }
  @Post('products/:id/publish') publish(@Param('id') id: string, @Headers('authorization') auth?: string) {
    return this.identity.publish(id, auth);
  }
}
