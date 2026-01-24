"use client";
import React, { useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { format } from 'date-fns';

interface Task {
  name: string;
  display_name: string;
  agent: {
    name: string;
    persona: string;
    avatar: string;
    color: string;
  };
  type: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  start_time: string | null;
  end_time: string | null;
  expected_start: string | null;
  message: string | null;
  metadata: Record<string, unknown> | null;
  dimensions: Record<string, string>;
  triggered_by: string | null;
}

export function StatusTimeline({ tasks }: { tasks: Task[] }) {
  return (
    <div className="relative border-l border-white/10 ml-6 space-y-8 py-4">
      {tasks.map((task, idx) => (
        <TimelineItem key={task.name + idx} task={task} />
      ))}
      
      {tasks.length === 0 && (
           <div className="ml-6 text-gray-500 italic">No tasks planned for this day.</div>
      )}
    </div>
  );
}

function TimelineItem({ task }: { task: Task }) {
  const [expanded, setExpanded] = useState(false);
  
  // Icon & Color Logic
  const isRunning = task.status === 'running';
  const isSuccess = task.status === 'success';
  const isFailed = task.status === 'failed';
  const isPending = task.status === 'pending';

  const timeDisplay = task.start_time 
      ? format(new Date(task.start_time), 'HH:mm') 
      : task.expected_start || '--:--';

  let dotClass = "bg-gray-900 border-gray-700";
  if (isRunning) dotClass = "bg-blue-900 border-blue-500 animate-ping"; // Pulse effect handled by wrapper maybe?
  if (isSuccess) dotClass = "bg-green-900 border-green-500";
  if (isFailed) dotClass = "bg-red-900 border-red-500";

  // Dimensions
  const dimKeys = Object.keys(task.dimensions || {});

  return (
    <div className="ml-6 relative group">
      {/* Timeline Dot */}
      <div className={`absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 ${dotClass} z-10 transition-colors`}>
         {/* Inner static dot if pinging */}
         {isRunning && <div className="absolute inset-0 rounded-full bg-blue-500 animate-none opacity-100 h-full w-full"></div>}
      </div>

      {/* Main Card */}
      <div 
        className={`p-4 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-all cursor-pointer ${expanded ? 'bg-white/10' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex justify-between items-start">
           {/* Left: Agent & Content */}
           <div className="flex gap-4">
               {/* Avatar */}
               <div className="flex-shrink-0 text-center">
                    {/* Placeholder Avatar if image missing, use initals */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-xs font-bold ring-1 ring-white/20">
                        {task.agent.persona[0]}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1">{task.agent.persona}</div>
               </div>

               {/* Text Info */}
               <div>
                   <div className="flex items-center gap-2">
                       <h3 className={`font-medium text-sm ${isFailed ? 'text-red-400' : 'text-gray-200'}`}>
                           {task.display_name}
                       </h3>
                       <StatusBadge type="status" value={task.status} />
                       {isPending && task.expected_start && (
                           <span className="text-xs text-gray-600">Plan: {task.expected_start}</span>
                       )}
                   </div>
                   
                   {/* Metadata Row */}
                   <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                       {dimKeys.map(k => (
                           <StatusBadge key={k} type={k as "market" | "tier" | "model"} value={task.dimensions[k]} />
                       ))}
                       {task.triggered_by && (
                           <div className="flex items-center gap-1 text-[10px] text-gray-500 ml-2 border-l border-white/10 pl-2">
                               <span className="opacity-50">BY</span>
                               <span>{task.triggered_by}</span>
                           </div>
                       )}
                   </div>
               </div>
           </div>

           {/* Right: Time & Duration */}
           <div className="text-right flex flex-col items-end">
               <div className="text-sm font-mono text-gray-400">{timeDisplay}</div>
               {task.end_time && task.start_time && (
                   <div className="text-[10px] text-gray-600">
                       {Math.round((new Date(task.end_time).getTime() - new Date(task.start_time).getTime()) / 1000)}s
                   </div>
               )}
           </div>
        </div>

        {/* Expandable Details */}
        {(expanded || isFailed) && (
             <div className="mt-3 pt-3 border-t border-white/5 text-sm">
                 {task.message && (
                     <div className={`mb-2 font-mono text-xs ${isFailed ? 'text-red-300' : 'text-gray-400'}`}>
                         {isFailed ? '❌ ' : '📝 '}{task.message}
                     </div>
                 )}
                 {task.metadata && (
                     <div className="bg-black/30 p-2 rounded text-xs font-mono text-gray-500 overflow-x-auto">
                         {JSON.stringify(task.metadata, null, 2)}
                     </div>
                 )}
             </div>
        )}
      </div>
    </div>
  );
}
