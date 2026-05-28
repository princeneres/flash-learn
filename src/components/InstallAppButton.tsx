import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Share } from "lucide-react";
import { Button } from "./ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import { toast } from "./ui/use-toast";
import { useInstallPrompt } from "../hooks/useInstallPrompt";

export const InstallAppButton = () => {
    const { t } = useTranslation();
    const { canPrompt, isIOS, isStandalone, promptInstall } = useInstallPrompt();
    const [iosOpen, setIosOpen] = useState(false);

    if (isStandalone || (!canPrompt && !isIOS)) {
        return null;
    }

    const handleClick = async () => {
        if (canPrompt) {
            const installed = await promptInstall();
            if (installed) toast({ title: t("install.success") });
            return;
        }
        setIosOpen(true);
    };

    return (
        <>
            <Button
                variant="outline"
                onClick={handleClick}
                className="gap-2 rounded-full bg-background/80"
                aria-label={t("install.button")}
            >
                <Download className="h-4 w-4" />
                <span className="hidden text-sm font-medium sm:inline">
                    {t("install.button")}
                </span>
            </Button>
            <Dialog open={iosOpen} onOpenChange={setIosOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t("install.iosTitle")}</DialogTitle>
                        <DialogDescription>
                            {t("install.iosIntro")}
                        </DialogDescription>
                    </DialogHeader>
                    <ol className="space-y-4">
                        {[
                            t("install.iosStep1"),
                            t("install.iosStep2"),
                            t("install.iosStep3"),
                        ].map((step, index) => (
                            <li
                                key={index}
                                className="flex items-center gap-3 text-sm text-foreground"
                            >
                                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                                    {index + 1}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    {step}
                                    {index === 0 && (
                                        <Share className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </span>
                            </li>
                        ))}
                    </ol>
                </DialogContent>
            </Dialog>
        </>
    );
};
