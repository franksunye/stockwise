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
    if (value === 'CN') className += "bg-red-900/30 text-red-200 border-red-800";
    else if (value === 'HK') className += "bg-blue-900/30 text-blue-200 border-blue-800";
    else className += "bg-gray-800 text-gray-300 border-gray-700";
  } 
  else if (type === 'tier') {
    if (value === 'PRO') className += "bg-amber-900/30 text-amber-200 border-amber-800";
    else className += "bg-slate-800 text-slate-300 border-slate-700";
  }
  else if (type === 'model') {
    if (value.includes('DeepSeek') || value === 'mixed') className += "bg-purple-900/30 text-purple-200 border-purple-800";
    else className += "bg-teal-900/30 text-teal-200 border-teal-800";
  }
  else if (type === 'trigger') {
      className = "text-[10px] text-gray-500 font-mono";
      // No border for trigger, just subtle text
      return <span className={className}>{value}</span>
  }
  else if (type === 'status') {
      if (value === 'success') className += "bg-green-900/30 text-green-300 border-green-800";
      else if (value === 'failed') className += "bg-red-900/30 text-red-300 border-red-800";
      else if (value === 'running') className += "bg-blue-900/30 text-blue-300 border-blue-800 animate-pulse";
      else className += "bg-gray-800 text-gray-400 border-gray-700"; // pending
  }
  
  return (
    <span className={className}>
      {value}
    </span>
  );
}
