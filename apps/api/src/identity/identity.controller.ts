import { Body, Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { IdentityService } from './identity.service';
@Controller()
export class IdentityController {
 constructor(private readonly identity: IdentityService) {}
 @Post('auth/register') register(@Body() body: any) { return this.identity.register(body ?? {}); }
 @Post('auth/login') login(@Body() body: any) { return this.identity.login(body ?? {}); }
 @Post('auth/logout') logout(@Headers('authorization') auth?: string) { return this.identity.logout(auth); }
 @Get('auth/me') me(@Headers('authorization') auth?: string) { return this.identity.me(auth); }
 @Get('admin/enrollments') requests(@Headers('authorization') auth?: string) { return this.identity.requests(auth); }
 @Post('admin/enrollments/:id/approve') approve(@Param('id') id: string,@Headers('authorization') auth?: string) { return this.identity.approve(id,auth); }
 @Post('company/invitations') invite(@Body() body: any,@Headers('authorization') auth?: string) { return this.identity.invite(body ?? {},auth); }
 @Post('auth/invitations/accept') accept(@Body() body: any) { return this.identity.accept(body ?? {}); }
 @Get('company/members') members(@Headers('authorization') auth?: string) { return this.identity.members(auth); }
 @Post('company/members/:id/revoke') revoke(@Param('id') id: string,@Headers('authorization') auth?: string) { return this.identity.revoke(id,auth); }
 @Patch('providers/:id/verify') verify(@Param('id') id: string,@Headers('authorization') auth?: string) { return this.identity.verify(id,auth); }
 @Post('products/:id/publish') publish(@Param('id') id: string,@Headers('authorization') auth?: string) { return this.identity.publish(id,auth); }
}
