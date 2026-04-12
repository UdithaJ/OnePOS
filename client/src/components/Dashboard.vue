<template>
  <v-container>
    <h2 class="mb-6">POS Dashboard</h2>
    <v-row>
      <v-col cols="12" md="4">
        <v-card color="primary" dark>
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-currency-usd</v-icon>
            Total Sales
          </v-card-title>
          <v-card-text>
            <div class="text-h4 font-weight-bold">$2,350.00</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card color="success" dark>
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-cart</v-icon>
            Orders Today
          </v-card-title>
          <v-card-text>
            <div class="text-h4 font-weight-bold">27</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card color="info" dark>
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-timer-sand</v-icon>
            Pending Orders
          </v-card-title>
          <v-card-text>
            <div class="text-h4 font-weight-bold">5</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <v-row class="mt-8">
      <v-col cols="12" md="6">
        <CashBox />
      </v-col>
      <v-col cols="12" md="6">
        <v-card class="pa-4">
          <div class="text-h6 mb-2">Quick Actions</div>
          <v-btn color="primary" class="mb-2" block>New Sale</v-btn>
          <v-btn color="success" block>View Reports</v-btn>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts" setup>
import CashBox from './CashBox.vue'
</script>