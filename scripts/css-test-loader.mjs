// Node-only SSR tests do not evaluate browser styles. Real browser checks cover CSS.
import {registerHooks} from 'node:module'
registerHooks({load(url,context,nextLoad){if(url.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};return nextLoad(url,context)}})
