import React from 'react';

type BadgeType = 'market' | 'tier' | 'model' | 'trigger' | 'status';

interface Props {
  type: BadgeType;
  value: string;
}

export function StatusBadge({ type, value }: Props) {
  let className = "px-2 py-0.5 rounded text-xs font-medium border ";
  
  // Style Logic based on Type & Value
  if (type === 'market') {
    if (value === 'CN' || value === 'A股') className += "bg-red-900/30 text-red-200 border-red-800";
    else if (value === 'HK' || value === '港股') className += "bg-blue-900/30 text-blue-200 border-blue-800";
    else className += "bg-gray-800 text-gray-300 border-gray-700";
  } 
  else if (type === 'tier') {
    if (value === 'PRO' || value === '专业版') className += "bg-amber-900/30 text-amber-200 border-amber-800";
    else className += "bg-slate-800 text-slate-300 border-slate-700";
  }
  else if (type === 'model') {
    if (value.includes('DeepSeek') || value === 'mixed' || value === '混合模型') className += "bg-purple-900/30 text-purple-200 border-purple-800";
    else className += "bg-teal-900/30 text-teal-200 border-teal-800";
  }
  else if (type === 'trigger') {
      className = "text-[10px] text-gray-500 font-mono";
      const displayValue = value === 'scheduler' ? '定时任务' : (value === 'user' ? '手动触发' : value);
      return <span className={className}>{displayValue}</span>
  }
  else if (type === 'status') {
      let displayValue = value;
      if (value === 'success') { className += "bg-green-900/30 text-green-300 border-green-800"; displayValue = "成功"; }
      else if (value === 'failed') { className += "bg-red-900/30 text-red-300 border-red-800"; displayValue = "失败"; }
      else if (value === 'running') { className += "bg-blue-900/30 text-blue-300 border-blue-800 animate-pulse"; displayValue = "执行中"; }
      else if (value === 'skipped') { className += "bg-gray-800 text-gray-400 border-gray-700"; displayValue = "由于不可抗力跳过"; }
      else { className += "bg-gray-800 text-gray-400 border-gray-700"; displayValue = "待运行"; } // pending
      
      return <span className={className}>{displayValue}</span>
  }
  
  return (
    <span className={className}>
      {value}
    </span>
  );
}
