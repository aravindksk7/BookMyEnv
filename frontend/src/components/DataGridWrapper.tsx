'use client';

import React from 'react';
import { Box, Chip, LinearProgress, Typography } from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRowsProp,
  GridToolbar,
  GridRowParams,
  GridPaginationModel,
  GridFilterModel,
  GridSortModel,
  GridRowSelectionModel,
  GridSlots,
} from '@mui/x-data-grid';

interface DataGridWrapperProps {
  rows: GridRowsProp;
  columns: GridColDef[];
  loading?: boolean;
  getRowId?: (row: any) => string;
  onRowClick?: (params: GridRowParams) => void;
  onRowDoubleClick?: (params: GridRowParams) => void;
  pageSize?: number;
  pageSizeOptions?: number[];
  checkboxSelection?: boolean;
  onRowSelectionChange?: (selection: GridRowSelectionModel) => void;
  disableRowSelectionOnClick?: boolean;
  autoHeight?: boolean;
  density?: 'compact' | 'standard' | 'comfortable';
  showToolbar?: boolean;
  showQuickFilter?: boolean;
  initialSort?: GridSortModel;
  initialFilter?: GridFilterModel;
  noRowsMessage?: string;
  height?: number | string;
  rowHeight?: number | 'auto';
  sx?: object;
}

// Custom no rows overlay
function NoRowsOverlay({ message }: { message: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        py: 4,
      }}
    >
      <Typography color="text.secondary">{message}</Typography>
    </Box>
  );
}

// Custom loading overlay
function LoadingOverlay() {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
      }}
    >
      <Box sx={{ width: '50%' }}>
        <LinearProgress />
      </Box>
    </Box>
  );
}

export default function DataGridWrapper({
  rows,
  columns,
  loading = false,
  getRowId,
  onRowClick,
  onRowDoubleClick,
  pageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  checkboxSelection = false,
  onRowSelectionChange,
  disableRowSelectionOnClick = true,
  autoHeight = false,
  density = 'standard',
  showToolbar = true,
  showQuickFilter = true,
  initialSort,
  initialFilter,
  noRowsMessage = 'No data found',
  height = 600,
  rowHeight = 'auto',
  sx,
}: DataGridWrapperProps) {
  const [paginationModel, setPaginationModel] = React.useState<GridPaginationModel>({
    pageSize,
    page: 0,
  });
  const [sortModel, setSortModel] = React.useState<GridSortModel>(initialSort || []);
  const [filterModel, setFilterModel] = React.useState<GridFilterModel>(initialFilter || { items: [] });

  // Custom slots for overlays
  const slots: Partial<GridSlots> = {
    noRowsOverlay: () => <NoRowsOverlay message={noRowsMessage} />,
    loadingOverlay: LoadingOverlay,
    ...(showToolbar && { toolbar: GridToolbar }),
  };

  return (
    <Box sx={{ width: '100%', height: autoHeight ? 'auto' : height, ...sx }}>
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        getRowId={getRowId}
        onRowClick={onRowClick}
        onRowDoubleClick={onRowDoubleClick}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={pageSizeOptions}
        sortModel={sortModel}
        onSortModelChange={setSortModel}
        filterModel={filterModel}
        onFilterModelChange={setFilterModel}
        checkboxSelection={checkboxSelection}
        onRowSelectionModelChange={onRowSelectionChange}
        disableRowSelectionOnClick={disableRowSelectionOnClick}
        density={density}
        slots={slots}
        slotProps={{
          toolbar: showQuickFilter
            ? {
                showQuickFilter: true,
                quickFilterProps: { debounceMs: 500 },
              }
            : undefined,
        }}
        getRowHeight={() => rowHeight === 'auto' ? 'auto' : rowHeight}
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          '& .MuiDataGrid-cell:focus': {
            outline: 'none',
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: 'action.hover',
          },
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: 'background.paper',
            borderBottom: 2,
            borderColor: 'divider',
          },
          '& .MuiDataGrid-toolbarContainer': {
            padding: 1,
            gap: 1,
            borderBottom: 1,
            borderColor: 'divider',
          },
          // Ensure cells wrap content properly with auto row height
          '& .MuiDataGrid-cell': {
            display: 'flex',
            alignItems: 'center',
            py: 1,
          },
        }}
        autoHeight={autoHeight}
        disableColumnMenu={false}
        initialState={{
          pagination: {
            paginationModel: { pageSize, page: 0 },
          },
        }}
      />
    </Box>
  );
}

// Export column type helpers
export type { GridColDef, GridRowParams, GridRowSelectionModel };

// Helper function to create action column
export function createActionsColumn(
  renderCell: (params: any) => React.ReactNode,
  width: number = 120
): GridColDef {
  return {
    field: 'actions',
    headerName: 'Actions',
    width,
    sortable: false,
    filterable: false,
    disableColumnMenu: true,
    align: 'right',
    headerAlign: 'right',
    renderCell,
  };
}

// Helper function to create chip column
export function createChipColumn(
  field: string,
  headerName: string,
  colorMap: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'>,
  width: number = 130
): GridColDef {
  return {
    field,
    headerName,
    width,
    renderCell: (params) => {
      const value = params.value;
      if (!value) return '-';
      return <Chip label={value} size="small" color={colorMap[value] || 'default'} />;
    },
  };
}
