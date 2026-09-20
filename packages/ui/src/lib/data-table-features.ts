import {
    columnFilteringFeature,
    rowPaginationFeature,
    rowSortingFeature,
    tableFeatures,
} from "@tanstack/react-table";

export const features = tableFeatures({
    columnFilteringFeature,
    rowPaginationFeature,
    rowSortingFeature,
});

export type DataTableFeatures = typeof features;
