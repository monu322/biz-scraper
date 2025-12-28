import { Box, Button, Card, CardContent, FormGroup, Rating, Typography } from "@mui/material";

import NiPlay from "@/icons/nexture/ni-play";
import NiStar from "@/icons/nexture/ni-star";
import { cn } from "@/lib/utils";

export default function DashboardLearningRecommended() {
  return (
    <>
      <Typography variant="h6" component="h6" className="mt-2 mb-3">
        Recommended for You
      </Typography>
      <Card
        className={cn(
          "bg-background-paper md:bg-[url(/images/misc/learn-hero.jpg)]",
          "outline-background-paper relative flex h-[382px] bg-cover bg-right bg-no-repeat p-0 outline-4 -outline-offset-4",
        )}
      >
        <Box className="from-background-paper to-background-paper/0 via-background-paper/0 absolute inset-0 z-0 bg-linear-to-r"></Box>
        <CardContent className="z-10 flex flex-1 flex-col items-start justify-between p-7!">
          <Box>
            <Typography variant="h4" component="h4" className="card-title">
              Complete Bonsai Tree Mastery
            </Typography>
            <Typography variant="body1" component="p" className="text-text-secondary mb-2 text-left md:max-w-xs">
              Discover the art and science of bonsai with engaging online courses that guide you through every step—from
              selecting the right tree to pruning, wiring, and shaping it into a living sculpture.
            </Typography>

            <FormGroup>
              <Box className="flex flex-row items-center">
                <Rating
                  readOnly
                  defaultValue={5}
                  max={5}
                  icon={<NiStar variant="contained" size="medium" />}
                  emptyIcon={<NiStar size="medium" className="outlined" />}
                />
                <Typography variant="body1" component="span" className="text-text-secondary ml-1">
                  (48)
                </Typography>
              </Box>
            </FormGroup>
          </Box>
          <Button size="medium" color="primary" variant="contained" startIcon={<NiPlay size={"medium"} />} href="#">
            Watch
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
