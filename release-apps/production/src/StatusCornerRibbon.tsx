import {villaStatusBadge} from './villaStatus'
type ReviewVilla=Parameters<typeof villaStatusBadge>[0]
export default function StatusCornerRibbon({villa}:{villa:ReviewVilla}){
 const status=villaStatusBadge(villa)
 return <div className={`status-corner-ribbon status-${status.tone}`} role="status"><span>{status.label}</span></div>
}
