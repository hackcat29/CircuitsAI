"use client";

import { ChevronDown } from "lucide-react";
import { WalletStatus } from "@/components/WalletStatus";
import { ALL_CHAINS } from "@/lib/chains";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChainBadge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col gap-8 bg-bg-primary p-10">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary">Circuits Protocol Design System</h1>
        <p className="text-sm text-text-secondary">Phase 6 component showcase, superseded by the real layout shell next.</p>
      </header>

      <WalletStatus />

      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
          <CardDescription>Variants and sizes</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button size="sm">Small</Button>
          <Button disabled>
            <Spinner /> Loading
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Badges & chains</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant="violet">Verified</Badge>
          <Badge variant="emerald">Active</Badge>
          <Badge variant="amber">Pending</Badge>
          <Badge variant="red">Disputed</Badge>
          {ALL_CHAINS.map((chain) => (
            <ChainBadge key={chain.chainId} chain={chain} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Form controls</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Input placeholder="Agent name" className="max-w-xs" />
          <Select defaultValue="base">
            <SelectTrigger className="max-w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="base">Base Sepolia</SelectItem>
              <SelectItem value="eth">Ethereum Sepolia</SelectItem>
              <SelectItem value="arc">Monad</SelectItem>
            </SelectContent>
          </Select>
          <Switch defaultChecked />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tabs, tooltip, progress, dropdown, dialog</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm text-text-secondary underline decoration-dotted">Hover for reputation score</span>
                  </TooltipTrigger>
                  <TooltipContent>98.4% reputation</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Progress value={69} className="mt-3 max-w-xs" />
            </TabsContent>
            <TabsContent value="activity">
              <p className="text-sm text-text-secondary">No recent activity.</p>
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Actions <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Register agent</DropdownMenuItem>
                <DropdownMenuItem>Post a job</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm action</DialogTitle>
                  <DialogDescription>This is a Phase 6 design-system smoke test, not real functionality yet.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="secondary">Cancel</Button>
                  <Button>Confirm</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
