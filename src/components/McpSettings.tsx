import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plug, Copy, Check, Terminal } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';

// Points the MCP server at this deployment, so the snippet is copy-paste ready.
// No credentials here: the `login` command issues a personal token.
const APP_URL = window.location.origin;

const CONFIG_SNIPPET = JSON.stringify(
  {
    mcpServers: {
      'flash-learn': {
        command: 'npx',
        args: ['-y', 'flash-learn-mcp'],
        env: {
          FLASH_LEARN_APP_URL: APP_URL,
        },
      },
    },
  },
  null,
  2,
);

const LOGIN_COMMAND = 'npx flash-learn-mcp login';

const CopyButton: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — user can still select manually */
    }
  };
  return (
    <Button type="button" size="sm" variant="outline" className="gap-2" onClick={copy}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {label}
    </Button>
  );
};

/**
 * Surfaces the MCP integration so users can connect Flash-Learn to their LLM
 * (Claude or any MCP client) and create decks/collections/quizzes by chatting.
 * Shows the two steps: register the server, then run the one-time `login`.
 */
export const McpSettings: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Card id="mcp" className="border-primary/30 bg-primary/[0.03]">
      <CardContent className="flex flex-col gap-5 p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Plug className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-bold">{t('mcp.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('mcp.description')}</p>
          </div>
        </div>

        {/* Step 1 — register the server in the MCP client */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">{t('mcp.step1Title')}</p>
            <CopyButton value={CONFIG_SNIPPET} label={t('mcp.copyConfig')} />
          </div>
          <p className="text-xs text-muted-foreground">{t('mcp.step1Hint')}</p>
          <pre className="overflow-x-auto rounded-xl border border-border/60 bg-muted/40 p-4 text-xs leading-relaxed">
            <code>{CONFIG_SNIPPET}</code>
          </pre>
        </div>

        {/* Step 2 — one-time account login (no token to copy) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">{t('mcp.step2Title')}</p>
            <CopyButton value={LOGIN_COMMAND} label={t('mcp.copyCommand')} />
          </div>
          <p className="text-xs text-muted-foreground">{t('mcp.step2Hint')}</p>
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 p-3 font-mono text-sm">
            <Terminal className="h-4 w-4 shrink-0 text-muted-foreground" />
            <code>{LOGIN_COMMAND}</code>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
