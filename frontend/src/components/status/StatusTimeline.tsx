import React, { useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { format, isPast, parseISO, parse } from 'date-fns';
import { User, Brain, Newspaper, Shield, Activity, Clock, CheckCircle2, XCircle } from 'lucide-react';

export interface Task {
  name: string;
  display_name: string;
  agent: {
    name: string;
    persona: string;
    avatar: string;
    color: string;
  };
  type: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
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
    <div className="relative ml-4 md:ml-10 space-y-0 pb-10">
      {/* Continuous Vertical Line */}
      <div className="absolute left-[19px] top-4 bottom-0 w-px bg-white/10" />
      
      {tasks.map((task, idx) => (
        <TimelineItem key={task.name + idx} task={task} />
      ))}
      
      {tasks.length === 0 && (
           <div className="ml-12 text-gray-500 italic py-10">No tasks planned for this day.</div>
      )}
    </div>
  );
}

function TimelineItem({ task }: { task: Task }) {
  const [expanded, setExpanded] = useState(false);
  
  // Logic to determine if "Pending" is actually "Missed"
  // Assuming task.expected_start is meant for Today.
  // This is a heuristic.
  let displayStatus = task.status;
  if (task.status === 'pending' && task.expected_start) {
      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      // Construct a rough date object for the planned time today
      // note: parsing strictly depends on format "HH:mm"
      const planTime = parse(`${todayStr} ${task.expected_start}`, 'yyyy-MM-dd HH:mm', new Date());
      
      // If plan time is in past (by > 30 mins) and still pending, perform visual downgrade
      if (isPast(planTime) && (now.getTime() - planTime.getTime() > 30 * 60000)) {
          displayStatus = 'skipped';
      }
  }

  const isRunning = displayStatus === 'running';
  const isSkipped = displayStatus === 'skipped';
  
  const timeDisplay = task.start_time 
      ? format(new Date(task.start_time), 'HH:mm') 
      : task.expected_start || '--:--';

  let dotClass = "bg-gray-900 border-gray-700 text-gray-500";
  if (isRunning) dotClass = "bg-blue-900/50 border-blue-500 text-blue-400 animate-pulse ring-2 ring-blue-500/20";
  if (displayStatus === 'success') dotClass = "bg-green-900/50 border-green-500 text-green-400";
  if (displayStatus === 'failed') dotClass = "bg-red-900/50 border-red-500 text-red-400";
  if (isSkipped) dotClass = "bg-gray-900 border-gray-800 text-gray-700";

  // Avatar Logic
  const avatarUrl = `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${task.agent.persona}`;

  return (
    <div className={`relative pl-12 py-4 group transition-all duration-300 ${isSkipped ? 'opacity-50 grayscale hover:grayscale-0 hover:opacity-80' : ''}`}>
      {/* Timeline Dot */}
      <div className={`absolute left-[11px] top-6 h-4 w-4 rounded-full border-2 flex items-center justify-center z-10 bg-[#050508] ${dotClass}`}>
         {displayStatus === 'success' && <div className="w-1.5 h-1.5 rounded-full bg-green-400" />}
         {displayStatus === 'failed' && <div className="w-1.5 h-1.5 rounded-full bg-red-400" />}
      </div>

      {/* Main Card */}
      <div 
        className={`p-4 rounded-xl border transition-all cursor-pointer 
            ${isRunning ? 'bg-blue-950/10 border-blue-800/30' : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/[0.07]'}
        `}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex justify-between items-start">
           {/* Left: Agent & Content */}
           <div className="flex gap-4 items-center">
               {/* Avatar */}
               <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-white/5 ring-1 ring-white/10">
                    <img 
                        src={avatarUrl} 
                        alt={task.agent.persona}
                        className="w-full h-full object-cover"
                    />
               </div>

               {/* Text Info */}
               <div>
                   <div className="flex items-center gap-3">
                       <h3 className={`font-medium text-sm ${task.status === 'failed' ? 'text-red-400' : 'text-gray-200'}`}>
                           {task.display_name}
                       </h3>
                       <StatusBadge type="status" value={displayStatus} />
                   </div>
                   
                   {/* Metadata Row */}
                   <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                       <span className="text-[10px] uppercase tracking-wider font-bold text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">{task.agent.persona}</span>
                       {Object.keys(task.dimensions || {}).map(k => (
                           <StatusBadge key={k} type={k as "market" | "tier" | "model"} value={task.dimensions[k] as string} />
                       ))}
                   </div>
               </div>
           </div>

           {/* Right: Time */}
           <div className="text-right">
               <div className={`text-sm font-mono font-medium ${isRunning ? 'text-blue-400' : 'text-gray-500'}`}>
                   {timeDisplay}
               </div>
               {task.triggered_by && task.triggered_by !== 'scheduler' && (
                   <div className="text-[10px] text-amber-500/80 mt-1">Manual</div>
               )}
           </div>
        </div>

        {/* Expandable Details */}
        {(expanded || isRunning || task.status === 'failed') && (
             <div className="mt-4 pt-3 border-t border-white/5 text-sm grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-top-1">
                 {task.message && (
                     <div className="font-mono text-xs text-gray-400">
                         {task.message}
                     </div>
                 )}
                 {task.metadata && (
                     <pre className="bg-black/30 p-2 rounded text-[10px] text-gray-500 overflow-x-auto border border-white/5">
                         {JSON.stringify(task.metadata, null, 2)}
                     </pre>
                 )}
             </div>
        )}
      </div>
    </div>
  );
}

