import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import { SyntheticEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

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
  GridActionsCellItem,
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
import NiPenSquare from "@/icons/nexture/ni-pen-square";
import NiPrinter from "@/icons/nexture/ni-printer";
import NiSearch from "@/icons/nexture/ni-search";
import { cn } from "@/lib/utils";

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

export default function Page() {
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>({
    type: "include",
    ids: new Set(),
  });

  const [scrapeDialogOpen, setScrapeDialogOpen] = useState(false);
  const [scrapeKeyword, setScrapeKeyword] = useState("");
  const [scrapeLocation, setScrapeLocation] = useState("");
  const [scrapeLimit, setScrapeLimit] = useState<number>(20);
  const [scraping, setScraping] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch contacts from backend
  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:8000/api/contacts");
      if (!response.ok) {
        throw new Error("Failed to fetch contacts");
      }
      const data: Contact[] = await response.json();
      
      // Transform API data to table rows
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
      alert("Failed to load contacts. Please check your backend connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load contacts on mount
  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleScrapeOpen = () => {
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
      const response = await fetch("http://localhost:8000/api/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keyword: scrapeKeyword,
          location: scrapeLocation,
          limit: scrapeLimit,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to scrape data");
      }

      const data = await response.json();
      console.log("Scrape successful:", data);
      
      // Refresh the table data
      await fetchContacts();
      
      // Close dialog and reset form
      handleScrapeClose();
    } catch (error) {
      console.error("Scraping error:", error);
      alert("Failed to scrape data. Please check your backend connection.");
    } finally {
      setScraping(false);
    }
  };

  const getRowSpacing = useCallback((params: GridRowSpacingParams) => {
    return {
      top: params.isFirstVisible ? 0 : 5,
      bottom: 5,
    };
  }, []);

  const columns: GridColDef<(typeof rows)[number]>[] = [
    {
      field: "id",
      headerName: "ID",
      width: 120,
      type: "string",
      renderCell: (params: GridRenderCellParams<any, string>) => (
        <Link
          to="#"
          className="text-text-primary link-primary link-underline-none hover:text-primary py-2 transition-colors"
        >
          {params.value}
        </Link>
      ),
    },
    {
      field: "name",
      headerName: "Name",
      width: 200,
      type: "string",
      renderCell: (params: GridRenderCellParams<any, string>) => (
        <Box className="flex h-full items-center gap-2">
          <Avatar className="bg-primary/80" alt={params.value} src={params.row.avatar}>
            {params.value?.substring(0, 1)}
          </Avatar>
          <Typography variant="body1" component="div">
            {params.value}
          </Typography>
        </Box>
      ),
    },
    { field: "avatar", headerName: "Avatar", width: 200, type: "string" },
    {
      field: "email",
      headerName: "Email",
      type: "string",
      width: 220,
    },
    {
      field: "company",
      headerName: "Company",
      width: 180,
      type: "string",
    },
    {
      field: "phone",
      headerName: "Phone",
      width: 160,
      type: "string",
    },
    {
      field: "address",
      headerName: "Address",
      width: 250,
      type: "string",
    },
    {
      field: "website",
      headerName: "Website",
      width: 200,
      type: "string",
      renderCell: (params: GridRenderCellParams<any, string>) => {
        if (params.value) {
          return (
            <Link
              to={params.value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary link-primary hover:underline"
            >
              {params.value}
            </Link>
          );
        }
        return <Box></Box>;
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
            <Box className="flex items-center gap-1">
              <Typography variant="body2">⭐ {params.value.toFixed(1)}</Typography>
            </Box>
          );
        }
        return <Box></Box>;
      },
    },
    {
      field: "lastContact",
      headerName: "Last Contact",
      align: "left",
      headerAlign: "left",
      width: 180,
      type: "dateTime",
      renderCell: (params: GridRenderCellParams<any, Date>) => {
        const value = params.value;
        if (value) {
          const diff = dayjs(value).diff(dayjs());
          return capitalize(dayjs.duration(diff, "milliseconds").humanize(true));
        } else {
          return <Box></Box>;
        }
      },
      filterOperators: getGridDateOperators(false).map((item) => ({
        ...item,
        InputComponent: DataGridDateTimeFilter,
      })),
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
          return (
            <Button
              className="pointer-events-none self-center"
              size="tiny"
              color="success"
              variant="pastel"
              startIcon={<NiCheckSquare size={"tiny"} />}
            >
              {value}
            </Button>
          );
        } else if (value === "Prospect") {
          return (
            <Button
              className="pointer-events-none self-center"
              size="tiny"
              color="warning"
              variant="pastel"
              startIcon={<NiClock size={"tiny"} />}
            >
              {value}
            </Button>
          );
        } else if (value === "Lead") {
          return (
            <Button
              className="pointer-events-none self-center"
              size="tiny"
              color="info"
              variant="pastel"
              startIcon={<NiMinusSquare size={"tiny"} />}
            >
              {value}
            </Button>
          );
        } else {
          return (
            <Button
              className="pointer-events-none self-center"
              size="tiny"
              color="grey"
              variant="pastel"
              startIcon={<NiExclamationSquare size={"tiny"} />}
            >
              {value}
            </Button>
          );
        }
      },
    },
  ];

  function CustomToolbar() {
    const [anchorElExport, setAnchorElExport] = useState<EventTarget | Element | PopoverVirtualElement | null>(null);
    const openExport = Boolean(anchorElExport);
    const handleClickExport = (event: Event | SyntheticEvent) => {
      setAnchorElExport(event.currentTarget);
    };
    const handleCloseExport = () => {
      setAnchorElExport(null);
    };

    const [anchorElSelection, setAnchorElSelection] = useState<EventTarget | Element | PopoverVirtualElement | null>(
      null,
    );
    const openSelection = Boolean(anchorElSelection);
    const handleClickSelection = (event: Event | SyntheticEvent) => {
      setAnchorElSelection(event.currentTarget);
    };
    const handleCloseSelection = () => {
      setAnchorElSelection(null);
    };

    return (
      <Toolbar className="min-h-auto border-none">
        <Grid container spacing={5} className="mb-4 w-full">
          <Grid container spacing={2.5} className="w-full" size={12}>
            <Grid size={{ xs: 12, md: "grow" }}>
              <Typography variant="h1" component="h1" className="mb-0">
                CRM
              </Typography>
              <Breadcrumbs>
                <Link color="inherit" to="/">
                  Home
                </Link>
                <Typography variant="body2">CRM</Typography>
              </Breadcrumbs>
            </Grid>

            <Grid size={{ xs: 12, md: "auto" }} className="flex flex-row items-start gap-2">
              {rowSelectionModel.ids.size > 0 && (
                <>
                  <Tooltip title="Selection">
                    <Button
                      className="surface-standard"
                      size="medium"
                      color="grey"
                      variant="surface"
                      onClick={handleClickSelection}
                      endIcon={
                        <NiChevronRightSmall
                          size={"medium"}
                          className={cn("transition-transform", openSelection && "rotate-90")}
                        />
                      }
                    >
                      {rowSelectionModel.ids.size > 1
                        ? rowSelectionModel.ids.size + " Contacts"
                        : rowSelectionModel.ids.size + " Contact"}
                    </Button>
                  </Tooltip>

                  <Menu
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "right" }}
                    anchorEl={anchorElSelection as Element}
                    open={openSelection}
                    onClose={handleCloseSelection}
                    className="mt-1"
                  >
                    <MenuItem onClick={() => handleCloseSelection()}>
                      <ListItemIcon>
                        <NiPenSquare size="medium" />
                      </ListItemIcon>
                      <ListItemText>Edit</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={() => handleCloseSelection()}>
                      <ListItemIcon>
                        <NiDuplicate size="medium" />
                      </ListItemIcon>
                      <ListItemText>Duplicate</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={() => handleCloseSelection()}>
                      <ListItemIcon>
                        <NiCrossSquare size="medium" />
                      </ListItemIcon>
                      <ListItemText>Delete</ListItemText>
                    </MenuItem>
                  </Menu>
                </>
              )}

              <Tooltip title="Scrape">
                <Button
                  className="icon-only surface-standard"
                  size="medium"
                  color="primary"
                  variant="surface"
                  onClick={handleScrapeOpen}
                >
                  <NiSearch size={"medium"} />
                </Button>
              </Tooltip>

              <Tooltip title="Columns">
                <ColumnsPanelTrigger
                  render={(props) => (
                    <Button
                      {...props}
                      className="icon-only surface-standard"
                      size="medium"
                      color="grey"
                      variant="surface"
                    >
                      <NiCols size={"medium"} />
                    </Button>
                  )}
                />
              </Tooltip>

              <Tooltip title="Filters">
                <FilterPanelTrigger
                  render={(props, state) => (
                    <Button
                      {...props}
                      className="icon-only surface-standard"
                      size="medium"
                      color="grey"
                      variant="surface"
                    >
                      <Badge badgeContent={state.filterCount} color="primary" variant="dot">
                        <NiFilter size={"medium"} />
                      </Badge>
                    </Button>
                  )}
                />
              </Tooltip>

              <Tooltip title="Export">
                <Button
                  className="icon-only surface-standard"
                  size="medium"
                  color="grey"
                  variant="surface"
                  startIcon={<NiArrowInDown size={"medium"} />}
                  onClick={handleClickExport}
                />
              </Tooltip>

              <Menu
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                anchorEl={anchorElExport as Element}
                open={openExport}
                onClose={handleCloseExport}
                className="mt-1"
              >
                <ExportPrint
                  render={
                    <MenuItem>
                      <ListItemIcon>
                        <NiPrinter size="medium" />
                      </ListItemIcon>
                      <ListItemText>Print</ListItemText>
                    </MenuItem>
                  }
                  onClick={handleCloseExport}
                />
                <ExportCsv
                  render={
                    <MenuItem>
                      <ListItemIcon>
                        <NiDocumentFull size="medium" />
                      </ListItemIcon>
                      <ListItemText>Export CSV</ListItemText>
                    </MenuItem>
                  }
                  onClick={handleCloseExport}
                />
              </Menu>
            </Grid>
          </Grid>

          <Grid container spacing={5} className="w-full" size={12}>
            <FormControl variant="filled" size="medium" className="surface mb-0 flex-1">
              <InputLabel>Search</InputLabel>
              <QuickFilter
                render={() => (
                  <QuickFilterControl
                    render={({ ref, ...controlProps }, state) => (
                      <FilledInput
                        {...controlProps}
                        inputRef={ref}
                        endAdornment={
                          <>
                            <InputAdornment position="end" className={cn(state.value === "" && "hidden")}>
                              <QuickFilterClear edge="end">
                                <NiCross size="medium" className="text-text-disabled" />
                              </QuickFilterClear>
                            </InputAdornment>
                            <InputAdornment position="end" className={cn(state.value !== "" && "hidden")}>
                              <IconButton edge="end">
                                {<NiSearch size="medium" className="text-text-disabled" />}
                              </IconButton>
                            </InputAdornment>
                          </>
                        }
                      />
                    )}
                  />
                )}
              />
            </FormControl>
          </Grid>
        </Grid>
      </Toolbar>
    );
  }

  return (
    <>
      <Dialog open={scrapeDialogOpen} onClose={handleScrapeClose} maxWidth="sm" fullWidth>
        <DialogTitle>{scraping ? "Scraping..." : "Scrape Data"}</DialogTitle>
        <DialogContent>
          <Box className="flex flex-col gap-4 pt-2">
            <TextField
              label="Keyword"
              variant="outlined"
              fullWidth
              value={scrapeKeyword}
              onChange={(e) => setScrapeKeyword(e.target.value)}
              placeholder="e.g., hvac, restaurants, plumbers"
              disabled={scraping}
            />
            <TextField
              label="Location"
              variant="outlined"
              fullWidth
              value={scrapeLocation}
              onChange={(e) => setScrapeLocation(e.target.value)}
              placeholder="e.g., London, New York"
              disabled={scraping}
            />
            <TextField
              label="Number of Records"
              variant="outlined"
              fullWidth
              type="number"
              value={scrapeLimit}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (value >= 1 && value <= 50) {
                  setScrapeLimit(value);
                }
              }}
              inputProps={{ min: 1, max: 50 }}
              helperText="Maximum 50 records"
              disabled={scraping}
            />
            {scraping && (
              <Box className="flex items-center justify-center gap-2 py-4">
                <Typography variant="body2" color="text.secondary">
                  Scraping data, please wait...
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleScrapeClose} color="grey" variant="text" disabled={scraping}>
            Cancel
          </Button>
          <Button 
            onClick={handleScrapeSubmit} 
            color="primary" 
            variant="contained" 
            disabled={!scrapeKeyword || !scrapeLocation || scraping}
          >
            {scraping ? "Scraping..." : "Scrape"}
          </Button>
        </DialogActions>
      </Dialog>

      <Grid container spacing={5}>
        <Grid size={12}>
          <DataGrid
          rows={rows}
          columns={columns}
          initialState={{
            columns: { columnVisibilityModel: { avatar: false } },
            pagination: {
              paginationModel: {
                pageSize: 10,
              },
            },
          }}
          getRowSpacing={getRowSpacing}
          rowHeight={68}
          columnHeaderHeight={32}
          checkboxSelection
          disableRowSelectionOnClick
          pageSizeOptions={[10]}
          className="full-page border-none"
          pagination
          slotProps={{
            panel: {
              className: "mt-1!",
            },
            main: {
              className: "min-h-[815px]! overflow-visible",
            },
          }}
          slots={{
            basePagination: DataGridPaginationFullPage,
            columnSortedDescendingIcon: () => {
              return <NiArrowDown size={"small"}></NiArrowDown>;
            },
            columnSortedAscendingIcon: () => {
              return <NiArrowUp size={"small"}></NiArrowUp>;
            },
            columnFilteredIcon: () => {
              return <NiFilterPlus size={"small"}></NiFilterPlus>;
            },
            columnReorderIcon: () => {
              return <NiChevronLeftRightSmall size={"small"}></NiChevronLeftRightSmall>;
            },
            columnMenuIcon: () => {
              return <NiEllipsisVertical size={"small"}></NiEllipsisVertical>;
            },
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
              return (
                <FormControl size="small" variant="outlined">
                  <InputLabel>{props.label}</InputLabel>
                  <Select {...propsCasted} IconComponent={NiChevronDownSmall} MenuProps={{ className: "outlined" }} />
                </FormControl>
              );
            },
            quickFilterIcon: () => {
              return <NiSearch size={"medium"} />;
            },
            quickFilterClearIcon: () => {
              return <NiCross size={"medium"} />;
            },
            baseButton: (props) => {
              return <Button {...props} variant="pastel" color="grey"></Button>;
            },
            moreActionsIcon: () => {
              return <NiEllipsisVertical size={"medium"} />;
            },
            toolbar: CustomToolbar,
          }}
          rowSelectionModel={rowSelectionModel}
          onRowSelectionModelChange={(rowSelectionModel: GridRowSelectionModel) => {
            setRowSelectionModel(rowSelectionModel);
          }}
          hideFooterSelectedRowCount
          showToolbar
          />
        </Grid>
      </Grid>
    </>
  );
}
