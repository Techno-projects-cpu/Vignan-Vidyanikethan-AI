/** Bounded casual chess opponent, not an LLM or a rated chess engine. */
import { allLegalMoves, applyUnchecked, inCheck } from './chess.js?v=95';
const VALUES={p:100,n:320,b:330,r:500,q:900,k:0};
function evaluate(state){let score=0;state.board.forEach((piece,index)=>{if(!piece)return;const center=3.5-Math.abs(3.5-index%8)+3.5-Math.abs(3.5-Math.floor(index/8));const bonus=['n','b'].includes(piece[1])?center*5:piece[1]==='p'?(piece[0]==='w'?6-Math.floor(index/8):Math.floor(index/8)-1)*4:0;score+=(VALUES[piece[1]]+bonus)*(piece[0]==='w'?1:-1);});return score*(state.turn==='w'?1:-1);}
const order=(state,moves)=>[...moves].sort((a,b)=>((VALUES[state.board[b.to]?.[1]]||0)+(b.promotion?800:0))-((VALUES[state.board[a.to]?.[1]]||0)+(a.promotion?800:0)));
export function chooseComputerMove(state,{level='normal',maxNodes=1800}={}){
 let nodes=0;const budget=Math.max(1,Math.min(5000,Number(maxNodes)||1800)),depth=level==='easy'?1:2;
 function search(position,left,alpha,beta){
  nodes++;if(nodes>=budget)return evaluate(position);
  const moves=allLegalMoves(position);if(!moves.length)return inCheck(position,position.turn)?-100000-left:0;
  if(!left||position.halfmove>=100)return position.halfmove>=100?0:evaluate(position);
  let best=-Infinity;
  for(const move of order(position,moves)){const value=-search(applyUnchecked(position,move),left-1,-beta,-alpha);best=Math.max(best,value);alpha=Math.max(alpha,value);if(alpha>=beta||nodes>=budget)break;}
  return best;
 }
 const moves=order(state,allLegalMoves(state));if(!moves.length)return {move:null,nodes};
 let best=moves[0],score=-Infinity;
 for(const move of moves){const value=-search(applyUnchecked(state,move),depth-1,-Infinity,Infinity);if(value>score){score=value;best=move;}if(nodes>=budget)break;}
 return {move:{from:best.from,to:best.to,...(best.promotion?{promotion:best.promotion}:{})},nodes};
}
