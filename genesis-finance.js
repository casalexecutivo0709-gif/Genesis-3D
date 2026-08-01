(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.GenesisFinance=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const round2=value=>Math.round((Number(value)||0)*100)/100;
  const cents=value=>Math.round((Number(value)||0)*100);
  const money=value=>cents(value)/100;
  const numberOrNull=value=>{
    if(value===null||value===undefined||value==='')return null;
    const parsed=Number(value);
    return Number.isFinite(parsed)?parsed:null;
  };

  function allocateCents(total,weights){
    const target=cents(total),list=(weights||[]).map(value=>Math.max(0,Number(value)||0));
    if(!list.length)return [];
    const sum=list.reduce((a,b)=>a+b,0);
    if(sum<=0){
      const base=Math.trunc(target/list.length),out=list.map(()=>base);
      out[out.length-1]+=target-out.reduce((a,b)=>a+b,0);
      return out.map(value=>value/100);
    }
    const exact=list.map(value=>target*value/sum);
    const out=exact.map(value=>Math.floor(value));
    let remainder=target-out.reduce((a,b)=>a+b,0);
    const order=exact.map((value,index)=>({index,fraction:value-Math.floor(value)}))
      .sort((a,b)=>b.fraction-a.fraction||a.index-b.index);
    for(let i=0;i<remainder;i++)out[order[i%order.length].index]++;
    return out.map(value=>value/100);
  }

  function isCancelled(order){
    const status=String(order?.status||'').toLowerCase();
    const financeStatus=String(order?.financialStatus||order?.shopee?.finance?.financialStatus||'').toLowerCase();
    return ['cancelado','cancelled','reembolsado','refunded','devolvido','returned','recusado','rejected','expirado','expired'].includes(status)
      || ['cancelled','refunded','returned'].includes(financeStatus);
  }

  function isRealized(order){
    if(!order||isCancelled(order))return false;
    const gross=Number(order?.shopee?.finance?.grossProductRevenue??order?.productTotal??order?.total??0)||0;
    if(gross<=0)return false;
    if(order.channel==='shopee'){
      const finance=order.shopee?.finance||{};
      return String(finance.financialStatus||order.financialStatus||'').toLowerCase()==='received'
        && Number(finance.netRevenueReceived??order.payment?.paid??0)>0;
    }
    const paymentStatus=String(order.payment?.status||'').toLowerCase();
    const orderStatus=String(order.status||'').toLowerCase();
    return ['paid','pago','confirmed','confirmado'].includes(paymentStatus)
      || (Number(order.payment?.paid)>0&&Number(order.payment?.balance||0)<=0)
      || orderStatus==='concluido';
  }

  function calculateSaleTotals({channel='direct',gross=0,received=null,cost=0}={}){
    const grossValue=money(Math.max(0,Number(gross)||0));
    const costValue=money(Math.max(0,Number(cost)||0));
    const isShopee=channel==='shopee';
    const receivedValue=isShopee
      ? money(Math.max(0,numberOrNull(received)??0))
      : grossValue;
    const fees=isShopee?money(Math.max(0,grossValue-receivedValue)):0;
    const revenue=receivedValue;
    const profit=money(revenue-costValue);
    return {
      gross:grossValue,
      fees,
      received:receivedValue,
      revenue,
      cost:costValue,
      profit,
      margin:revenue>0?round2(profit/revenue*100):0
    };
  }

  function rawOrderItems(order){
    if(Array.isArray(order?.kitItems)&&order.kitItems.length){
      return order.kitItems.map(item=>({...item,originItem:'kit',kitId:order.kitId||item.kitId||'',kitName:order.productName||item.kitName||''}));
    }
    if(Array.isArray(order?.items)&&order.items.length){
      return order.items.map(item=>({...item,originItem:'individual',kitId:'',kitName:''}));
    }
    return [{
      id:order?.productId||order?.id||'item',productId:order?.productId||'',
      productName:order?.productName||'Produto sem nome',qty:order?.qty||1,
      unitPrice:order?.unitPrice||0,subtotal:order?.productTotal,
      originItem:'individual',kitId:'',kitName:''
    }];
  }

  function itemNormalSubtotal(item){
    const qty=Math.max(1,parseInt(item?.qty??item?.quantity,10)||1);
    const explicit=numberOrNull(item?.normalSubtotal??item?.originalSubtotal??item?.subtotal);
    if(explicit!==null&&explicit>=0)return money(explicit);
    return money((Number(item?.unitPrice??item?.precoNormalUnitario)||0)*qty);
  }

  function itemKnownCost(item){
    const qty=Math.max(1,parseInt(item?.qty??item?.quantity,10)||1);
    const total=numberOrNull(item?.costTotal??item?.totalCost??item?.custoTotal);
    if(total!==null&&total>=0)return money(total);
    const unit=numberOrNull(item?.costUnit??item?.unitCost??item?.custoUnitario);
    return unit!==null&&unit>=0?money(unit*qty):null;
  }

  function orderCostSnapshot(order){
    const direct=numberOrNull(order?.financialSnapshot?.cost);
    if(direct!==null&&direct>=0)return money(direct);
    const unit=numberOrNull(order?.internalSnapshot?.custoUnitario??order?.internalSnapshot?.unitCost);
    const qty=Math.max(1,parseInt(order?.qty,10)||1);
    return unit!==null&&unit>=0?money(unit*qty):0;
  }

  function normalizeSale(order,{includeUnrealized=false}={}){
    if(!order||(!includeUnrealized&&!isRealized(order)))return null;
    const channel=order.channel==='shopee'?'shopee':(order.channel||'direct');
    const gross=channel==='shopee'
      ? Number(order.shopee?.finance?.grossProductRevenue??order.financialSnapshot?.grossRevenue??order.productTotal??order.total??0)
      : Number(order.productTotal??order.financialSnapshot?.grossRevenue??order.total??0);
    const received=channel==='shopee'
      ? Number(order.shopee?.finance?.netRevenueReceived??order.financialSnapshot?.revenue??order.payment?.paid??0)
      : gross;
    const sourceItems=rawOrderItems(order);
    const normalWeights=sourceItems.map(itemNormalSubtotal);
    const knownCosts=sourceItems.map(itemKnownCost);
    let costTotal=orderCostSnapshot(order);
    if(!costTotal&&knownCosts.every(value=>value!==null))costTotal=money(knownCosts.reduce((a,b)=>a+b,0));
    const totals=calculateSaleTotals({channel,gross,received,cost:costTotal});
    const grossAllocated=allocateCents(totals.gross,normalWeights);
    const feeAllocated=allocateCents(totals.fees,grossAllocated);
    const revenueAllocated=allocateCents(totals.revenue,grossAllocated);
    const costWeights=knownCosts.some(value=>value!==null)?knownCosts.map((value,index)=>value??normalWeights[index]):normalWeights;
    const costAllocated=allocateCents(totals.cost,costWeights);
    const items=sourceItems.map((item,index)=>{
      const qty=Math.max(1,parseInt(item?.qty??item?.quantity,10)||1);
      const normal=normalWeights[index];
      const grossItem=grossAllocated[index],feesItem=feeAllocated[index],revenueItem=revenueAllocated[index],costItem=costAllocated[index];
      const profitItem=money(revenueItem-costItem);
      const discountPct=normal>0?round2(Math.max(0,(1-grossItem/normal)*100)):0;
      return {
        id:item.id||`${order.id||'sale'}-item-${index+1}`,
        saleId:`sale-${order.id||order.shopeeOrderId||index}`,
        orderId:order.id||'',productId:item.productId||item.linkedModelId||item.shopeeItemId||'',
        productName:item.productName||item.name||order.productName||'Produto sem nome',
        qty,originItem:item.originItem||'individual',kitId:item.kitId||'',kitName:item.kitName||'',
        normalUnitPrice:qty?money(normal/qty):0,discountPercent:discountPct,
        gross:grossItem,fees:feesItem,revenue:revenueItem,
        costUnit:qty?money(costItem/qty):0,cost:costItem,profit:profitItem,
        margin:revenueItem>0?round2(profitItem/revenueItem*100):0,
        timeHours:Number(item.timeHours)||0,weightGrams:Number(item.weight??item.pesoG)||0,
        filamentName:item.filamentName||''
      };
    });
    return {
      id:`sale-${order.id||order.shopeeOrderId||Date.now()}`,orderId:order.id||'',
      shopeeOrderId:order.shopeeOrderId||order.shopee?.number||'',date:order.shopee?.orderDate||order.payment?.receivedAt||order.createdAt,
      channel,status:order.status||'',clientId:order.client?.id||'',clientName:order.client?.name||'',
      ...totals,discount:money(Math.max(0,normalWeights.reduce((a,b)=>a+b,0)-totals.gross)),items
    };
  }

  function deduplicateOrders(orders){
    const map=new Map();
    (orders||[]).forEach(order=>{
      const external=String(order?.shopeeOrderId||order?.shopee?.number||'').trim().toUpperCase();
      const key=external?`shopee:${external}`:`order:${order?.id||''}`;
      if(!key.endsWith(':')){
        const current=map.get(key);
        if(!current||Number(order.updatedAt||order.createdAt||0)>=Number(current.updatedAt||current.createdAt||0))map.set(key,order);
      }
    });
    return [...map.values()];
  }

  function aggregateInsights(orders){
    const sales=deduplicateOrders(orders).map(order=>normalizeSale(order)).filter(Boolean);
    const totals=sales.reduce((out,sale)=>{
      out.orders++;out.gross+=sale.gross;out.fees+=sale.fees;out.revenue+=sale.revenue;out.cost+=sale.cost;out.profit+=sale.profit;
      out.items.push(...sale.items);return out;
    },{orders:0,gross:0,fees:0,revenue:0,cost:0,profit:0,items:[]});
    ['gross','fees','revenue','cost','profit'].forEach(key=>totals[key]=money(totals[key]));
    totals.margin=totals.revenue>0?round2(totals.profit/totals.revenue*100):0;
    totals.ticket=totals.orders?money(totals.revenue/totals.orders):0;
    totals.sales=sales;
    return totals;
  }

  function validateSale(sale){
    if(!sale)return {ok:false,errors:['Venda ausente']};
    const sum=key=>money((sale.items||[]).reduce((total,item)=>total+(Number(item[key])||0),0));
    const errors=[];
    [['gross','gross'],['fees','fees'],['revenue','revenue'],['cost','cost'],['profit','profit']].forEach(([itemKey,saleKey])=>{
      if(cents(sum(itemKey))!==cents(sale[saleKey]))errors.push(`${itemKey}: ${sum(itemKey)} != ${sale[saleKey]}`);
    });
    return {ok:!errors.length,errors};
  }

  return {round2,allocateCents,isRealized,calculateSaleTotals,normalizeSale,deduplicateOrders,aggregateInsights,validateSale};
});
