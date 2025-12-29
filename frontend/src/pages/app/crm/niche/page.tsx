import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import { SyntheticEvent, useCallback, useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";

import {
  Avatar,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  capitalize,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FilledInput,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  PopoverVirtualElement,
  Select,
  SelectProps,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Grid } from "@mui/material";
import { getGridDateOperators, GridColDef } from "@mui/x-data-grid";
import {
  ColumnsPanelTrigger,
  DataGrid,
  ExportCsv,
  ExportPrint,
  FilterPanelTrigger,
  GridRenderCellParams,
  GridRowSelectionModel,
  GridRowSpacingParams,
  QuickFilter,
  QuickFilterClear,
  QuickFilterControl,
  Toolbar,
} from "@mui/x-data-grid";

import DataGridDateTimeFilter from "@/components/data-grid/data-grid-date-time-filter";
import { DataGridPaginationFullPage } from "@/components/data-grid/data-grid-pagination";
import NiArrowDown from "@/icons/nexture/ni-arrow-down";
import NiArrowInDown from "@/icons/nexture/ni-arrow-in-down";
import NiArrowUp from "@/icons/nexture/ni-arrow-up";
import NiBinEmpty from "@/icons/nexture/ni-bin-empty";
import NiCheckSquare from "@/icons/nexture/ni-check-square";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import NiChevronLeftRightSmall from "@/icons/nexture/ni-chevron-left-right-small";
import NiChevronRightSmall from "@/icons/nexture/ni-chevron-right-small";
import NiClock from "@/icons/nexture/ni-clock";
import NiCols from "@/icons/nexture/ni-cols";
import NiCross from "@/icons/nexture/ni-cross";
import NiCrossSquare from "@/icons/nexture/ni-cross-square";
import NiDocumentFull from "@/icons/nexture/ni-document-full";
import NiDuplicate from "@/icons/nexture/ni-duplicate";
import NiEllipsisVertical from "@/icons/nexture/ni-ellipsis-vertical";
import NiExclamationSquare from "@/icons/nexture/ni-exclamation-square";
import NiEyeInactive from "@/icons/nexture/ni-eye-inactive";
import NiFilter from "@/icons/nexture/ni-filter";
import NiFilterPlus from "@/icons/nexture/ni-filter-plus";
import NiMinusSquare from "@/icons/nexture/ni-minus-square";
import NiArrowHistory from "@/icons/nexture/ni-arrow-history";
import NiEmail from "@/icons/nexture/ni-email";
import NiPenSquare from "@/icons/nexture/ni-pen-square";
import NiPrinter from "@/icons/nexture/ni-printer";
import NiSearch from "@/icons/nexture/ni-search";
import { cn } from "@/lib/utils";

interface Niche {
  id: number;
  name: string;
  description: string | null;
  locations: string[];
  contact_count: number;
}

interface Contact {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  rating: number | null;
  reviews_count: number | null;
  category: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

type Row = {
  id: string | number;
  name: string;
  avatar?: string;
  email: string | null;
  company: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  rating: number | null;
  lastContact: Date | null;
  status: string;
};

dayjs.extend(duration);
dayjs.extend(relativeTime);

export default function NicheDetailPage() {
  const { nicheId } = useParams<{ nicheId: string }>();
  const navigate = useNavigate();
  
  const [niche, setNiche] = useState<Niche | null>(null);
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>({
    type: "include",
    ids: new Set(),
  });

  const [scrapeDialogOpen, setScrapeDialogOpen] = useState(false);
  const [scrapeKeyword, setScrapeKeyword] = useState("");
  const [scrapeLocation, setScrapeLocation] = useState("");
  const [scrapeLimit, setScrapeLimit] = useState<string>("20");
  const [scraping, setScraping] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch niche details
  const fetchNiche = useCallback(async () => {
    if (!nicheId) return;
    try {
      const response = await fetch(`http://localhost:8000/api/niches/${nicheId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch niche");
      }
      const data: Niche = await response.json();
      setNiche(data);
    } catch (error) {
      console.error("Error fetching niche:", error);
      alert("Failed to load niche. It may not exist.");
      navigate("/crm");
    }
  }, [nicheId, navigate]);

  // Fetch contacts for this niche
  const fetchContacts = useCallback(async () => {
    if (!nicheId) return;
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/niches/${nicheId}/contacts`);
      if (!response.ok) {
        throw new Error("Failed to fetch contacts");
      }
      const data: Contact[] = await response.json();
      
      const transformedRows: Row[] = data.map((contact) => ({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        company: contact.company,
        phone: contact.phone,
        address: contact.address,
        website: contact.website,
        rating: contact.rating,
        lastContact: contact.created_at ? new Date(contact.created_at) : null,
        status: contact.status,
      }));
      
      setRows(transformedRows);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      alert("Failed to load contacts.");
    } finally {
      setLoading(false);
    }
  }, [nicheId]);

  useEffect(() => {
    fetchNiche();
    fetchContacts();
  }, [fetchNiche, fetchContacts]);

  const handleScrapeOpen = () => {
    // Prefill with niche name and first location
    if (niche) {
      setScrapeKeyword(niche.name);
      if (niche.locations && niche.locations.length > 0) {
        setScrapeLocation(niche.locations[0]);
      }
    }
    setScrapeDialogOpen(true);
  };

  const handleScrapeClose = () => {
    setScrapeDialogOpen(false);
    setScrapeKeyword("");
    setScrapeLocation("");
  };

  const handleScrapeSubmit = async () => {
    setScraping(true);
    try {
      const response = await fetch(`http://localhost:8000/api/niches/${nicheId}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: scrapeKeyword,
          location: scrapeLocation,
          limit: parseInt(scrapeLimit) || 20,
        }),
      });

      if (!response.ok) throw new Error("Failed to scrape data");

      const data = await response.json();
      console.log("Scrape successful:", data);
      
      await fetchContacts();
      await fetchNiche();
      handleScrapeClose();
    } catch (error) {
      console.error("Scraping error:", error);
      alert("Failed to scrape data.");
    } finally {
      setScraping(false);
    }
  };

  const handleEnrichEmails = async () => {
    if (!confirm("This will find missing emails from business websites. Continue?")) return;
    
    setEnriching(true);
    try {
      const response = await fetch(`http://localhost:8000/api/niches/${nicheId}/enrich-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to enrich emails");

      const data = await response.json();
      await fetchContacts();
      alert(`Enriched ${data.enriched_count} contacts with emails`);
    } catch (error) {
      console.error("Enrichment error:", error);
      alert("Failed to enrich emails.");
    } finally {
      setEnriching(false);
    }
  };

  const handleResetNAEmails = async () => {
    if (!confirm("This will reset all emails marked as 'N/A' back to null, allowing them to be enriched again. Continue?")) return;
    
    setResetting(true);
    try {
      const response = await fetch("http://localhost:8000/api/reset-na-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to reset emails");

      const data = await response.json();
      await fetchContacts();
      alert(`Reset ${data.reset_count} email(s) from N/A to null`);
    } catch (error) {
      console.error("Reset error:", error);
      alert("Failed to reset emails.");
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteAllContacts = async () => {
    if (!confirm("⚠️ WARNING: This will delete ALL contacts in this niche. Continue?")) return;
    
    setDeleting(true);
    try {
      const response = await fetch(`http://localhost:8000/api/niches/${nicheId}/contacts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to delete contacts");

      const data = await response.json();
      await fetchContacts();
      await fetchNiche();
      alert(`Deleted ${data.deleted_count} contact(s)`);
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete contacts.");
    } finally {
      setDeleting(false);
    }
  };

  const getRowSpacing = useCallback((params: GridRowSpacingParams) => {
    return { top: params.isFirstVisible ? 0 : 5, bottom: 5 };
  }, []);

  const columns: GridColDef<(typeof rows)[number]>[] = [
    {
      field: "id",
      headerName: "ID",
      width: 120,
      type: "string",
    },
    {
      field: "name",
      headerName: "Name",
      width: 250,
      type: "string",
      renderCell: (params: GridRenderCellParams<any, string>) => {
        const googleMapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(params.value || "")}`;
        return (
          <Box className="flex h-full items-center gap-2">
            <Avatar className="bg-primary/80" alt={params.value} src={params.row.avatar}>
              {params.value?.substring(0, 1)}
            </Avatar>
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {params.value}
            </a>
          </Box>
        );
      },
    },
    { field: "email", headerName: "Email", type: "string", width: 220 },
    { field: "company", headerName: "Company", width: 180, type: "string" },
    { field: "phone", headerName: "Phone", width: 160, type: "string" },
    { field: "address", headerName: "Address", width: 250, type: "string" },
    {
      field: "website",
      headerName: "Website",
      width: 200,
      type: "string",
      renderCell: (params: GridRenderCellParams<any, string>) => {
        if (params.value) {
          return (
            <a href={params.value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {params.value}
            </a>
          );
        }
        return null;
      },
    },
    {
      field: "rating",
      headerName: "Rating",
      width: 120,
      type: "number",
      renderCell: (params: GridRenderCellParams<any, number>) => {
        if (params.value) {
          return (
            <Box className="flex h-full items-center gap-1.5">
              <span className="text-base leading-none">⭐</span>
              <Typography variant="body2" className="leading-none">{params.value.toFixed(1)}</Typography>
            </Box>
          );
        }
        return null;
      },
    },
    {
      field: "status",
      headerName: "Status",
      align: "left",
      headerAlign: "left",
      minWidth: 140,
      flex: 1,
      type: "singleSelect",
      valueOptions: ["Active", "Inactive", "Prospect", "Lead"],
      renderCell: (params: GridRenderCellParams<any, string>) => {
        const value = params.value;
        if (value === "Active") {
          return <Button className="pointer-events-none self-center" size="tiny" color="success" variant="pastel" startIcon={<NiCheckSquare size={"tiny"} />}>{value}</Button>;
        } else if (value === "Prospect") {
          return <Button className="pointer-events-none self-center" size="tiny" color="warning" variant="pastel" startIcon={<NiClock size={"tiny"} />}>{value}</Button>;
        } else if (value === "Lead") {
          return <Button className="pointer-events-none self-center" size="tiny" color="info" variant="pastel" startIcon={<NiMinusSquare size={"tiny"} />}>{value}</Button>;
        } else {
          return <Button className="pointer-events-none self-center" size="tiny" color="grey" variant="pastel" startIcon={<NiExclamationSquare size={"tiny"} />}>{value}</Button>;
        }
      },
    },
  ];

  function CustomToolbar() {
    const [anchorElExport, setAnchorElExport] = useState<EventTarget | Element | PopoverVirtualElement | null>(null);
    const openExport = Boolean(anchorElExport);

    return (
      <Toolbar className="min-h-auto border-none">
        <Grid container spacing={5} className="mb-4 w-full">
          <Grid container spacing={2.5} className="w-full" size={12}>
            <Grid size={{ xs: 12, md: "grow" }}>
              <Typography variant="h1" component="h1" className="mb-0">
                {niche?.name || "Loading..."}
              </Typography>
              <Breadcrumbs>
                <Link color="inherit" to="/">Home</Link>
                <Link color="inherit" to="/crm">CRM</Link>
                <Typography variant="body2">{niche?.name}</Typography>
              </Breadcrumbs>
            </Grid>

            <Grid size={{ xs: 12, md: "auto" }} className="flex flex-row items-start gap-2">
              <Tooltip title="Scrape">
                <Button className="icon-only surface-standard" size="medium" color="primary" variant="surface" onClick={handleScrapeOpen} disabled={enriching}>
                  <NiSearch size={"medium"} />
                </Button>
              </Tooltip>

              <Tooltip title="Enrich Emails">
                <Button className="icon-only surface-standard" size="medium" color="success" variant="surface" onClick={handleEnrichEmails} disabled={enriching || scraping}>
                  <NiEmail size={"medium"} />
                </Button>
              </Tooltip>

              <Tooltip title="Reset N/A Emails">
                <Button className="icon-only surface-standard" size="medium" color="warning" variant="surface" onClick={handleResetNAEmails} disabled={enriching || scraping || resetting || deleting}>
                  <NiArrowHistory size={"medium"} />
                </Button>
              </Tooltip>

              <Tooltip title="Delete All Contacts">
                <Button className="icon-only surface-standard" size="medium" color="error" variant="surface" onClick={handleDeleteAllContacts} disabled={enriching || scraping || deleting}>
                  <NiBinEmpty size={"medium"} />
                </Button>
              </Tooltip>

              <Tooltip title="Columns">
                <ColumnsPanelTrigger render={(props) => (
                  <Button {...props} className="icon-only surface-standard" size="medium" color="grey" variant="surface">
                    <NiCols size={"medium"} />
                  </Button>
                )} />
              </Tooltip>

              <Tooltip title="Filters">
                <FilterPanelTrigger render={(props, state) => (
                  <Button {...props} className="icon-only surface-standard" size="medium" color="grey" variant="surface">
                    <Badge badgeContent={state.filterCount} color="primary" variant="dot">
                      <NiFilter size={"medium"} />
                    </Badge>
                  </Button>
                )} />
              </Tooltip>

              <Tooltip title="Export">
                <Button className="icon-only surface-standard" size="medium" color="grey" variant="surface" startIcon={<NiArrowInDown size={"medium"} />} onClick={(e) => setAnchorElExport(e.currentTarget)} />
              </Tooltip>

              <Menu anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }} anchorEl={anchorElExport as Element} open={openExport} onClose={() => setAnchorElExport(null)} className="mt-1">
                <ExportPrint render={<MenuItem><ListItemIcon><NiPrinter size="medium" /></ListItemIcon><ListItemText>Print</ListItemText></MenuItem>} onClick={() => setAnchorElExport(null)} />
                <ExportCsv render={<MenuItem><ListItemIcon><NiDocumentFull size="medium" /></ListItemIcon><ListItemText>Export CSV</ListItemText></MenuItem>} onClick={() => setAnchorElExport(null)} />
              </Menu>
            </Grid>
          </Grid>

          <Grid container spacing={5} className="w-full" size={12}>
            <FormControl variant="filled" size="medium" className="surface mb-0 flex-1">
              <InputLabel>Search</InputLabel>
              <QuickFilter render={() => (
                <QuickFilterControl render={({ ref, ...controlProps }, state) => (
                  <FilledInput {...controlProps} inputRef={ref} endAdornment={
                    <>
                      <InputAdornment position="end" className={cn(state.value === "" && "hidden")}>
                        <QuickFilterClear edge="end"><NiCross size="medium" className="text-text-disabled" /></QuickFilterClear>
                      </InputAdornment>
                      <InputAdornment position="end" className={cn(state.value !== "" && "hidden")}>
                        <IconButton edge="end"><NiSearch size="medium" className="text-text-disabled" /></IconButton>
                      </InputAdornment>
                    </>
                  } />
                )} />
              )} />
            </FormControl>
          </Grid>
        </Grid>
      </Toolbar>
    );
  }

  return (
    <>
      <Dialog open={scrapeDialogOpen} onClose={handleScrapeClose} maxWidth="sm" fullWidth>
        <DialogTitle>{scraping ? "Scraping..." : `Scrape for ${niche?.name}`}</DialogTitle>
        <DialogContent>
          <Box className="flex flex-col gap-4 pt-2">
            <TextField label="Keyword" variant="outlined" fullWidth value={scrapeKeyword} onChange={(e) => setScrapeKeyword(e.target.value)} placeholder="e.g., hvac, restaurants, plumbers" disabled={scraping} />
            <TextField label="Location" variant="outlined" fullWidth value={scrapeLocation} onChange={(e) => setScrapeLocation(e.target.value)} placeholder="e.g., London, New York" disabled={scraping} />
            <TextField label="Number of Records" variant="outlined" fullWidth type="number" value={scrapeLimit} onChange={(e) => setScrapeLimit(e.target.value)} inputProps={{ min: 1, max: 50 }} helperText="1-50 records" disabled={scraping} />
            {scraping && <Box className="flex items-center justify-center gap-2 py-4"><Typography variant="body2" color="text.secondary">Scraping data, please wait...</Typography></Box>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleScrapeClose} color="grey" variant="text" disabled={scraping}>Cancel</Button>
          <Button onClick={handleScrapeSubmit} color="primary" variant="contained" disabled={!scrapeKeyword || !scrapeLocation || scraping}>{scraping ? "Scraping..." : "Scrape"}</Button>
        </DialogActions>
      </Dialog>

      <Grid container spacing={5}>
        {rows.length > 0 && (
          <Grid size={12}>
            <Box className="mb-4 rounded-lg bg-surface-container p-4">
              <Box className="mb-2 flex items-center justify-between">
                <Typography variant="body2" className="text-text-secondary">Email Enrichment Progress</Typography>
                <Typography variant="body2" className="font-medium">
                  {(() => {
                    const withEmail = rows.filter(r => r.email && r.email !== "N/A").length;
                    const percentage = Math.round((withEmail / rows.length) * 100);
                    return `${withEmail} / ${rows.length} contacts (${percentage}%)`;
                  })()}
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={(() => {
                const withEmail = rows.filter(r => r.email && r.email !== "N/A").length;
                return Math.round((withEmail / rows.length) * 100);
              })()} color="success" className="h-2 rounded-full" />
            </Box>
          </Grid>
        )}
        <Grid size={12}>
          <DataGrid
            rows={rows}
            columns={columns}
            initialState={{ columns: { columnVisibilityModel: { avatar: false } }, pagination: { paginationModel: { pageSize: 10 } } }}
            getRowSpacing={getRowSpacing}
            rowHeight={68}
            columnHeaderHeight={32}
            checkboxSelection
            disableRowSelectionOnClick
            pageSizeOptions={[10]}
            className="full-page border-none"
            pagination
            slotProps={{ panel: { className: "mt-1!" }, main: { className: "min-h-[600px]! overflow-visible" } }}
            slots={{
              basePagination: DataGridPaginationFullPage,
              columnSortedDescendingIcon: () => <NiArrowDown size={"small"} />,
              columnSortedAscendingIcon: () => <NiArrowUp size={"small"} />,
              columnFilteredIcon: () => <NiFilterPlus size={"small"} />,
              columnReorderIcon: () => <NiChevronLeftRightSmall size={"small"} />,
              columnMenuIcon: () => <NiEllipsisVertical size={"small"} />,
              columnMenuSortAscendingIcon: NiArrowUp,
              columnMenuSortDescendingIcon: NiArrowDown,
              columnMenuFilterIcon: NiFilter,
              columnMenuHideIcon: NiEyeInactive,
              columnMenuClearIcon: NiCross,
              columnMenuManageColumnsIcon: NiCols,
              filterPanelDeleteIcon: NiCross,
              filterPanelRemoveAllIcon: NiBinEmpty,
              baseSelect: (props: any) => {
                const propsCasted = props as SelectProps;
                return <FormControl size="small" variant="outlined"><InputLabel>{props.label}</InputLabel><Select {...propsCasted} IconComponent={NiChevronDownSmall} MenuProps={{ className: "outlined" }} /></FormControl>;
              },
              quickFilterIcon: () => <NiSearch size={"medium"} />,
              quickFilterClearIcon: () => <NiCross size={"medium"} />,
              baseButton: (props) => <Button {...props} variant="pastel" color="grey" />,
              moreActionsIcon: () => <NiEllipsisVertical size={"medium"} />,
              toolbar: CustomToolbar,
            }}
            rowSelectionModel={rowSelectionModel}
            onRowSelectionModelChange={(model) => setRowSelectionModel(model)}
            hideFooterSelectedRowCount
            showToolbar
          />
        </Grid>
      </Grid>
    </>
  );
}
