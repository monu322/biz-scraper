import { Box, Button, Card, CardContent, Typography } from "@mui/material";

import NiPlay from "@/icons/nexture/ni-play";
import { cn } from "@/lib/utils";

export default function LearnHero() {
  return (
    <Card
      className={cn(
        "bg-background-paper md:bg-[url(/images/misc/learn-hero.jpg)]",
        "relative flex min-h-80 bg-cover bg-center bg-no-repeat p-0",
      )}
    >
      <Box className="from-background-paper to-background-paper/0 via-background-paper/0 absolute inset-0 z-0 bg-linear-to-r"></Box>
      <CardContent className="z-10 flex flex-1 flex-col items-start justify-between p-7!">
        <Box>
          <Typography variant="h4" component="h4" className="card-title">
            Quick Introduction
          </Typography>
          <Typography variant="body1" component="p" className="text-text-secondary text-left md:max-w-md">
            Create custom visuals from text prompts in seconds—no design skills needed. Transform ideas into dynamic
            video clips with AI-powered motion and storytelling.
          </Typography>
        </Box>
        <Button size="medium" color="primary" variant="contained" startIcon={<NiPlay size={"medium"} />} href="#">
          Watch
        </Button>
      </CardContent>
    </Card>
  );
}
