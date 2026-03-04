/**
 * Venues Collection
 *
 * Family-friendly event spaces in Baltimore — churches, rec centers, community spaces
 */

import type { CollectionConfig } from "@sonicjs-cms/core";

export default {
  name: "venues",
  displayName: "Venues",
  description: "Family-friendly event spaces in Baltimore",
  icon: "🏛️",

  schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        title: "Venue Name",
        required: true,
        maxLength: 200,
      },
      slug: {
        type: "slug",
        title: "URL Slug",
        required: true,
        maxLength: 200,
      },
      venueType: {
        type: "select",
        title: "Venue Type",
        enum: ["church", "rec_center", "community_center", "library", "school"],
        enumLabels: ["Church Hall", "Recreation Center", "Community Center", "Library", "School"],
        required: true,
      },
      description: {
        type: "textarea",
        title: "Description",
        required: true,
      },
      address: {
        type: "string",
        title: "Street Address",
        required: true,
      },
      neighborhood: {
        type: "string",
        title: "Neighborhood",
        required: true,
      },
      latitude: {
        type: "number",
        title: "Latitude",
      },
      longitude: {
        type: "number",
        title: "Longitude",
      },
      distanceFromPark: {
        type: "number",
        title: "Distance from Patterson Park (miles)",
      },
      capacity: {
        type: "number",
        title: "Max Capacity",
        required: true,
      },
      hourlyRate: {
        type: "number",
        title: "Hourly Rate ($)",
        required: true,
      },
      hasKitchen: {
        type: "boolean",
        title: "Kitchen Available",
      },
      hasGymnasium: {
        type: "boolean",
        title: "Gymnasium Available",
      },
      alcoholPolicy: {
        type: "select",
        title: "Alcohol Policy",
        enum: ["none", "beer_wine", "full_bar"],
        enumLabels: ["No Alcohol", "Beer & Wine Only", "Full Bar"],
      },
      adaAccessible: {
        type: "boolean",
        title: "ADA Accessible",
      },
      parkingSpaces: {
        type: "number",
        title: "Parking Spaces",
      },
      imageUrl: {
        type: "string",
        title: "Image URL",
      },
      heroImageUrl: {
        type: "string",
        title: "Hero Image URL",
      },
      contactPhone: {
        type: "string",
        title: "Contact Phone",
      },
      contactEmail: {
        type: "string",
        title: "Contact Email",
      },
      amenities: {
        type: "string",
        title: "Amenities",
        helpText: "Comma-separated: tables, chairs, sound_system, projector, wifi, stage",
      },
      status: {
        type: "select",
        title: "Status",
        enum: ["active", "inactive", "maintenance"],
        enumLabels: ["Active", "Inactive", "Under Maintenance"],
        default: "active",
      },
    },
    required: ["title", "slug", "venueType", "description", "address", "neighborhood", "capacity", "hourlyRate"],
  },

  listFields: ["title", "venueType", "neighborhood", "capacity", "hourlyRate", "status"],
  searchFields: ["title", "description", "address", "neighborhood"],
  defaultSort: "title",
  defaultSortOrder: "asc",

  managed: true,
  isActive: true,
} satisfies CollectionConfig;
