import {villaStatusBadge} from './villaStatus'
import {useLocale} from './locale'
import './dashboard-documents.css'
type ReviewVilla=Parameters<typeof villaStatusBadge>[0]
export default function StatusCornerRibbon({villa}:{villa:ReviewVilla}){
 useLocale()
 const status=villaStatusBadge(villa)
 return <div className={`status-corner-ribbon status-${status.tone}`} role="status" aria-label={status.label}><span>{status.label}</span></div>
}
