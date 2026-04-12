<template>
  <v-card color="secondary" dark>
    <v-card-title class="d-flex align-center">
      <v-icon class="mr-2">mdi-cash</v-icon>
      Cash Box
    </v-card-title>
    <v-card-text>
      <div class="d-flex align-center mb-2">
        <v-icon color="yellow-darken-2" class="mr-2">mdi-currency-usd</v-icon>
        <span class="text-h4 font-weight-bold">$1,200.00</span>
      </div>
      <div class="mb-1">
        <v-icon class="mr-1" size="18">mdi-clock-outline</v-icon>
        Open: 9:00 AM
      </div>
      <div class="mb-1">
        <v-icon class="mr-1" size="18">mdi-checkbox-marked-circle-outline</v-icon>
        Status: <span class="font-weight-bold">Open</span>
      </div>
    </v-card-text>
    <v-card-actions class="d-flex flex-row justify-space-between">
      <v-btn icon color="success" title="Add Inflow">
        <v-icon>mdi-plus-circle</v-icon>
      </v-btn>
      <v-btn icon color="error" title="Add Outflow">
        <v-icon>mdi-minus-circle</v-icon>
      </v-btn>
      <v-spacer />
      <v-btn color="error">Close Cash Box</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts" setup>
// Sample static cash box info
</script>