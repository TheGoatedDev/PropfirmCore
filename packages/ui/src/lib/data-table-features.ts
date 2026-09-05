import {
    rowPaginationFeature,
    rowSortingFeature,
    tableFeatures,
} from "@tanstack/react-table";

export const features = tableFeatures({
    rowPaginationFeature,
    rowSortingFeature,
});

export type DataTableFeatures = typeof features;
