import { PropsWithChildren, useEffect, useState } from "react";

import { Box, Paper } from "@mui/material";

import { cn } from "@/lib/utils";
import { useThemeContext } from "@/theme/theme-provider";
import { ContentType } from "@/types/types";

export default function ContentWrapper({ children }: PropsWithChildren) {
  const { content } = useThemeContext();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Paper
      elevation={0}
      className="debug-paper flex min-h-[calc(100vh-7.5rem)] w-full rounded-xl bg-transparent px-4 py-5 sm:rounded-4xl sm:py-6 md:py-8 lg:px-6"
    >
      <Box className="debug-outer-box flex w-full">
        <Box className={cn("debug-middle-box flex-1 transition-all", content === ContentType.Boxed && "")}>
          <Box className="debug-inner-box min-h-full w-full *:mb-2">{children}</Box>
        </Box>
      </Box>
    </Paper>
  );
}
