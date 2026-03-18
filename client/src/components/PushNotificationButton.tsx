import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function PushNotificationButton() {
  const { permission, isSubscribed, isLoading, subscribe, unsubscribe } =
    usePushNotifications();

  if (permission === "unsupported") return null;

  if (permission === "denied") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" disabled className="opacity-50">
              <BellOff className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Notificações bloqueadas no navegador</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isSubscribed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={unsubscribe}
              disabled={isLoading}
              className="text-amber-600"
            >
              <BellRing className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Notificações ativas — clique para desativar</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={subscribe}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Ativar notificações no celular</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
