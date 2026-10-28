import {listPlans} from "../server/catalog.mjs";
import {Injectable} from "@nestjs/common";
import {PrismaDatabaseService} from "./prisma.service.js";
import {DomainService} from "./domain.service.js";
import {productionRuntimePolicy,phase1PackageDisplay} from "../server/production-runtime.mjs";
@Injectable()
export class PackageService {
 constructor(private readonly database:PrismaDatabaseService,private readonly domain:DomainService){}
 async listActive(){
  await this.domain.ready();
  const plans=await listPlans(this.database);
  return {packages:productionRuntimePolicy(process.env).phase1?plans.map(phase1PackageDisplay):plans};
 }
}
