// Lightweight markdown renderer used by the Learn surfaces. Supports GitHub-style
// emphasis, inline code, and KaTeX math via $...$ / $$...$$ blocks. Math is the
// reason this exists — SO-Learn answers routinely contain notation like
// D_KL[q(z) ∥ p(z|s)] that is unreadable as plain prose, especially on mobile.

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

type Props = {
  text: string;
  className?: string;
};

export function Markdown({ text, className }: Props) {
  return (
    <div className={['prose-learn', className].filter(Boolean).join(' ')}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className="my-1 whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
          ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
          li: ({ children }) => <li className="my-0.5">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-slate-100">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children }) => (
            <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[0.85em] text-emerald-200">
              {children}
            </code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-1 border-l-2 border-slate-700 pl-2 italic text-slate-400">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-[0.85em]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="border-b border-slate-700">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-slate-800">{children}</tr>,
          th: ({ children }) => (
            <th className="px-2 py-1 text-left font-semibold text-slate-300">{children}</th>
          ),
          td: ({ children }) => <td className="px-2 py-1 text-slate-400">{children}</td>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
