import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders assistant / user chat copy with GFM markdown (bold, lists, tables, etc.).
 * @param {'assistant' | 'user'} variant
 */
export function ChatMarkdown({ children, variant = 'assistant' }) {
    const isUser = variant === 'user';

    const shell = isUser
        ? 'chat-md-user text-[13px] leading-relaxed text-white/95 [&_p]:mb-2.5 [&_p]:last:mb-0 [&_strong]:font-semibold [&_strong]:text-white [&_em]:text-white/90 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:space-y-1 [&_li]:leading-relaxed [&_blockquote]:border-l-2 [&_blockquote]:border-white/40 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:text-white/85 [&_a]:text-indigo-100 [&_a]:underline-offset-2 [&_a:hover]:text-white [&_code]:rounded-md [&_code]:bg-white/15 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-900/35 [&_pre]:p-3 [&_pre]:text-[12px] [&_hr]:my-3 [&_hr]:border-white/25 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1.5 [&_table]:my-2 [&_table]:w-full [&_table]:text-left [&_table]:text-[12px] [&_th]:border [&_th]:border-white/20 [&_th]:bg-white/10 [&_th]:px-2 [&_th]:py-1.5 [&_td]:border [&_td]:border-white/15 [&_td]:px-2 [&_td]:py-1.5'
        : 'chat-md-assistant text-[13px] leading-relaxed text-slate-700 [&_p]:mb-2.5 [&_p]:last:mb-0 [&_strong]:font-semibold [&_strong]:text-slate-900 [&_em]:text-slate-600 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:space-y-1 [&_li]:leading-relaxed [&_blockquote]:border-l-[3px] [&_blockquote]:border-indigo-200 [&_blockquote]:bg-indigo-50/40 [&_blockquote]:pl-3 [&_blockquote]:py-1.5 [&_blockquote]:my-2.5 [&_blockquote]:rounded-r-lg [&_blockquote]:text-slate-600 [&_blockquote]:italic [&_a]:font-medium [&_a]:text-indigo-600 [&_a]:underline-offset-2 hover:[&_a]:text-indigo-700 [&_code]:rounded-md [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_code]:text-slate-800 [&_pre]:my-2.5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-slate-200 [&_pre]:bg-slate-50 [&_pre]:p-3 [&_pre]:text-[12px] [&_hr]:my-3 [&_hr]:border-slate-200 [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mb-1.5 [&_table]:my-2 [&_table]:w-full [&_table]:text-left [&_table]:text-[12px] [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-100 [&_th]:font-semibold [&_th]:px-2 [&_th]:py-1.5 [&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1.5';

    return (
        <div className={shell}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
        </div>
    );
}
