import {listPlans} from "../server/catalog.mjs";
import {Injectable} from "@nestjs/common";
import {PrismaDatabaseService} from "./prisma.service.js";
import {DomainService} from "./domain.service.js";
@Injectable()
export class PackageService {
 constructor(private readonly database:PrismaDatabaseService,private readonly domain:DomainService){}
 async listActive(){
  await this.domain.ready();
  return {packages:await listPlans(this.database)};
 }
}
