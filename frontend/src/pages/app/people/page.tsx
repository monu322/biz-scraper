import { Typography, Grid, Box } from "@mui/material";

export default function Page() {
  return (
    <Grid container spacing={5}>
      <Grid size={12}>
        <Box>
          <Typography variant="h1" component="h1" className="mb-2">
            People
          </Typography>
          <Typography variant="body1" className="text-text-secondary">
            People management system.
          </Typography>
        </Box>
      </Grid>
    </Grid>
  );
}
