import {t as translateSystem} from "./locale"
import {t} from './locale'
// Presentation only: workflow values and review history remain unchanged.
export function villaStatusBadge(villa:{status:string;document?:{data?:string};documentReviewStatus?:string;reviewRequest?:{startedAt?:string}}){
 if(villa.status==='approved')return {label:translateSystem('อนุมัติแล้ว'),tone:'approved'}
 if(villa.status==='rejected')return {label:translateSystem('ปฏิเสธการอนุมัติ'),tone:'rejected'}
 if(villa.status==='changes')return {label:translateSystem('รอการแก้ไข'),tone:'changes'}
 // Missing an initial submission is distinct from a reviewed document needing revision.
 if(!villa.document?.data)return {label:translateSystem('กรุณาแนบเอกสาร'),tone:'changes'}
 if(villa.documentReviewStatus==='IN_REVIEW'||villa.reviewRequest?.startedAt)return {label:translateSystem('อยู่ระหว่างการพิจารณา'),tone:'reviewing'}
 return {label:translateSystem('รอตรวจสอบ'),tone:'pending'}
}
