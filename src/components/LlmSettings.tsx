import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  LlmService,
  PROVIDER_DEFAULTS,
  llmErrorKey,
  type LlmProvider,
} from "../services/LlmService";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { useToast } from "./ui/use-toast";

export const LlmSettings: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const uid = currentUser?.id ?? "";
  const existing = uid ? LlmService.getConfig(uid) : null;

  const [provider, setProvider] = useState<LlmProvider>(existing?.provider ?? "anthropic");
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? "");
  const [baseUrl, setBaseUrl] = useState(
    existing?.baseUrl ?? PROVIDER_DEFAULTS[existing?.provider ?? "anthropic"].baseUrl
  );
  const [model, setModel] = useState(
    existing?.model ?? PROVIDER_DEFAULTS[existing?.provider ?? "anthropic"].model
  );
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configured, setConfigured] = useState(!!existing && existing.apiKey.length > 0);

  const handleProviderChange = (value: string) => {
    const next = value as LlmProvider;
    setProvider(next);
    // Swap defaults when the user hasn't customized them for the old provider.
    setBaseUrl((prev) =>
      prev === PROVIDER_DEFAULTS[provider].baseUrl || !prev
        ? PROVIDER_DEFAULTS[next].baseUrl
        : prev
    );
    setModel((prev) =>
      prev === PROVIDER_DEFAULTS[provider].model || !prev
        ? PROVIDER_DEFAULTS[next].model
        : prev
    );
  };

  const buildConfig = () => ({
    provider,
    apiKey: apiKey.trim(),
    baseUrl: baseUrl.trim() || PROVIDER_DEFAULTS[provider].baseUrl,
    model: model.trim() || PROVIDER_DEFAULTS[provider].model,
  });

  const handleSave = () => {
    if (!uid || !apiKey.trim()) {
      toast({ title: t("ai.settings.keyRequired"), variant: "destructive" });
      return;
    }
    LlmService.saveConfig(uid, buildConfig());
    setConfigured(true);
    toast({ title: t("ai.settings.saved") });
  };

  const handleTest = async () => {
    if (!apiKey.trim()) {
      toast({ title: t("ai.settings.keyRequired"), variant: "destructive" });
      return;
    }
    setTesting(true);
    try {
      await LlmService.testConnection(buildConfig());
      toast({ title: t("ai.settings.testOk") });
    } catch (err) {
      console.error(err);
      toast({ title: t(llmErrorKey(err)), variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const handleClear = () => {
    if (!uid) return;
    LlmService.clearConfig(uid);
    setApiKey("");
    setConfigured(false);
    toast({ title: t("ai.settings.cleared") });
  };

  return (
    <div className="space-y-5 rounded-2xl border border-border/60 bg-background/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 text-sm font-medium">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <p>{t("ai.settings.title")}</p>
            <p className="text-xs font-normal text-muted-foreground">
              {t("ai.settings.subtitle")}
            </p>
          </div>
        </div>
        {configured && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("ai.settings.configured")}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="llm-provider">{t("ai.settings.provider")}</Label>
        <Select value={provider} onValueChange={handleProviderChange}>
          <SelectTrigger id="llm-provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
            <SelectItem value="openai">{t("ai.settings.openaiCompatible")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="llm-key">{t("ai.settings.apiKey")}</Label>
        <div className="flex gap-2">
          <Input
            id="llm-key"
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === "anthropic" ? "sk-ant-..." : "sk-..."}
            autoComplete="off"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setShowKey((v) => !v)}
            aria-label={t("ai.settings.toggleKey")}
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("ai.settings.keyHint")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="llm-model">{t("ai.settings.model")}</Label>
          <Input
            id="llm-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={PROVIDER_DEFAULTS[provider].model}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="llm-base">{t("ai.settings.baseUrl")}</Label>
          <Input
            id="llm-base"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={PROVIDER_DEFAULTS[provider].baseUrl}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleSave} disabled={!apiKey.trim()}>
          {t("common.save")}
        </Button>
        <Button type="button" variant="outline" onClick={handleTest} disabled={testing || !apiKey.trim()}>
          {testing ? t("ai.settings.testing") : t("ai.settings.test")}
        </Button>
        {configured && (
          <Button type="button" variant="ghost" onClick={handleClear} className="text-destructive">
            {t("ai.settings.clear")}
          </Button>
        )}
      </div>
    </div>
  );
};
