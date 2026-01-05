import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiUrl } from "@/lib/api";

import {
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  CardActionArea,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Tooltip,
  Typography,
  Chip,
} from "@mui/material";
import { Grid } from "@mui/material";

import NiPlus from "@/icons/nexture/ni-plus";
import NiBinEmpty from "@/icons/nexture/ni-bin-empty";
import NiChevronRightSmall from "@/icons/nexture/ni-chevron-right-small";

interface Niche {
  id: number;
  name: string;
  description: string | null;
  locations: string[];
  contact_count: number;
  created_at: string;
  updated_at: string;
}

export default function Page() {
  const navigate = useNavigate();
  const [niches, setNiches] = useState<Niche[]>([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newNicheName, setNewNicheName] = useState("");
  const [newNicheDescription, setNewNicheDescription] = useState("");
  const [newNicheLocations, setNewNicheLocations] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchNiches = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl("/api/niches"));
      if (!response.ok) {
        throw new Error("Failed to fetch niches");
      }
      const data: Niche[] = await response.json();
      setNiches(data);
    } catch (error) {
      console.error("Error fetching niches:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNiches();
  }, [fetchNiches]);

  const handleCreateNiche = async () => {
    if (!newNicheName.trim()) return;
    
    setCreating(true);
    try {
      const locations = newNicheLocations
        .split(",")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const response = await fetch(apiUrl("/api/niches"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newNicheName,
          description: newNicheDescription || null,
          locations: locations,
        }),
      });

      if (!response.ok) throw new Error("Failed to create niche");

      await fetchNiches();
      setCreateDialogOpen(false);
      setNewNicheName("");
      setNewNicheDescription("");
      setNewNicheLocations("");
    } catch (error) {
      console.error("Error creating niche:", error);
      alert("Failed to create niche.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteNiche = async (nicheId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this niche? All contacts in this niche will have their niche_id set to null.")) {
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/niches/${nicheId}`), {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete niche");

      await fetchNiches();
    } catch (error) {
      console.error("Error deleting niche:", error);
      alert("Failed to delete niche.");
    }
  };

  const handleNicheClick = (nicheId: number) => {
    navigate(`/crm/niche/${nicheId}`);
  };

  return (
    <>
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Niche</DialogTitle>
        <DialogContent>
          <Box className="flex flex-col gap-4 pt-2">
            <TextField
              label="Niche Name"
              variant="outlined"
              fullWidth
              value={newNicheName}
              onChange={(e) => setNewNicheName(e.target.value)}
              placeholder="e.g., Plumbing Businesses"
              disabled={creating}
              autoFocus
            />
            <TextField
              label="Description (optional)"
              variant="outlined"
              fullWidth
              multiline
              rows={2}
              value={newNicheDescription}
              onChange={(e) => setNewNicheDescription(e.target.value)}
              placeholder="e.g., Local plumbing and heating companies"
              disabled={creating}
            />
            <TextField
              label="Locations (comma separated)"
              variant="outlined"
              fullWidth
              value={newNicheLocations}
              onChange={(e) => setNewNicheLocations(e.target.value)}
              placeholder="e.g., London, Manchester, Birmingham"
              helperText="Enter multiple locations separated by commas"
              disabled={creating}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} color="grey" variant="text" disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreateNiche} color="primary" variant="contained" disabled={!newNicheName.trim() || creating}>
            {creating ? "Creating..." : "Create Niche"}
          </Button>
        </DialogActions>
      </Dialog>

      <Grid container spacing={5}>
        <Grid size={12}>
          <Box className="mb-4 flex items-center justify-between">
            <Box>
              <Typography variant="h1" component="h1" className="mb-0">
                CRM
              </Typography>
              <Breadcrumbs>
                <Link color="inherit" to="/">
                  Home
                </Link>
                <Typography variant="body2">CRM</Typography>
              </Breadcrumbs>
            </Box>
            <Button
              color="primary"
              variant="contained"
              startIcon={<NiPlus size="medium" />}
              onClick={() => setCreateDialogOpen(true)}
            >
              New Niche
            </Button>
          </Box>
        </Grid>

        {loading ? (
          <Grid size={12}>
            <Box className="flex items-center justify-center py-12">
              <Typography variant="body1" color="text.secondary">
                Loading niches...
              </Typography>
            </Box>
          </Grid>
        ) : niches.length === 0 ? (
          <Grid size={12}>
            <Box className="flex flex-col items-center justify-center py-12 text-center">
              <Typography variant="h3" className="mb-2">
                No Niches Yet
              </Typography>
              <Typography variant="body1" color="text.secondary" className="mb-4">
                Create your first niche to start organizing your contacts by industry or category.
              </Typography>
              <Button
                color="primary"
                variant="contained"
                startIcon={<NiPlus size="medium" />}
                onClick={() => setCreateDialogOpen(true)}
              >
                Create Your First Niche
              </Button>
            </Box>
          </Grid>
        ) : (
          niches.map((niche) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={niche.id}>
              <Card className="h-full">
                <CardActionArea onClick={() => handleNicheClick(niche.id)} className="h-full">
                  <CardContent className="h-full flex flex-col">
                    <Box className="flex items-start justify-between mb-2">
                      <Typography variant="h3" className="mb-0 flex-1">
                        {niche.name}
                      </Typography>
                      <Tooltip title="Delete Niche">
                        <Button
                          className="icon-only"
                          size="small"
                          color="error"
                          variant="text"
                          onClick={(e) => handleDeleteNiche(niche.id, e)}
                        >
                          <NiBinEmpty size="small" />
                        </Button>
                      </Tooltip>
                    </Box>
                    
                    {niche.description && (
                      <Typography variant="body2" color="text.secondary" className="mb-3">
                        {niche.description}
                      </Typography>
                    )}

                    <Box className="flex-1" />

                    <Box className="mt-3">
                      {niche.locations && niche.locations.length > 0 && (
                        <Box className="flex flex-wrap gap-1 mb-3">
                          {niche.locations.slice(0, 3).map((location, idx) => (
                            <Chip key={idx} label={location} size="small" variant="outlined" />
                          ))}
                          {niche.locations.length > 3 && (
                            <Chip label={`+${niche.locations.length - 3} more`} size="small" variant="outlined" />
                          )}
                        </Box>
                      )}

                      <Box className="flex items-center justify-between">
                        <Typography variant="body2" color="text.secondary">
                          {niche.contact_count} contact{niche.contact_count !== 1 ? "s" : ""}
                        </Typography>
                        <NiChevronRightSmall size="medium" className="text-text-secondary" />
                      </Box>
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))
        )}
      </Grid>
    </>
  );
}
