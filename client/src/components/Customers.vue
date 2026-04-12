<template>
  <v-container>
    <h2 class="mb-4">Customers</h2>
    <v-card>
      <v-card-title>
        <v-icon class="mr-2">mdi-account-group</v-icon>
        Customer List
      </v-card-title>
      <v-card-text>
        <v-table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Alice Smith</td>
              <td>alice@example.com</td>
              <td>555-1234</td>
            </tr>
            <tr>
              <td>Bob Johnson</td>
              <td>bob@example.com</td>
              <td>555-5678</td>
            </tr>
            <tr>
              <td>Charlie Lee</td>
              <td>charlie@example.com</td>
              <td>555-9012</td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script lang="ts" setup>
// Static customer data for now
</script>