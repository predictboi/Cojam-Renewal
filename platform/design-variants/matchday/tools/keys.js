global.window=global;global.location={search:""};global.localStorage={getItem(){return null},setItem(){}};global.document={documentElement:{}};
require('/home/user/Cojam-Renewal/platform/design/assets/i18n.js');
const d=CJ_I18N.dict.en;for(const k of Object.keys(d))console.log(k+' = '+d[k]);
