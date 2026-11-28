import { chooseComputerMove } from './solo-chess.js?v=95';
self.onmessage = ({data}) => {
  try { const result=chooseComputerMove(data.state,{level:data.level,maxNodes:1800});self.postMessage({id:data.id,...result}); }
  catch { self.postMessage({id:data.id,error:'The local opponent could not choose a move. Try again or restart.'}); }
};
