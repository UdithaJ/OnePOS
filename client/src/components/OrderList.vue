<template>
  <div class="orders-ui-redesign neomorphic-container">
    <main class="main-content neomorphic-container">
      <header class="header neomorphic-card">
        <div class="breadcrumbs">Softwash · Orders</div>
        <div class="title-search">
          <input class="search" type="text" placeholder="Search by order #, customer, phone..." v-model="searchQuery" />
          <button class="new-order" @click="handleNewOrderClick">+ New order</button>
        </div>
        <!-- Status button filters removed as requested -->
      </header>
      <section class="orders-list">
        <v-alert v-if="errorMsg" type="error" class="mb-4 neomorphic-card">{{ errorMsg }}</v-alert>
        <v-alert
          v-if="!loading && !errorMsg && (overdueCount > 0 || dueSoonCount > 0)"
          :type="overdueCount > 0 ? 'error' : 'warning'"
          variant="tonal"
          class="mb-4"
        >
          <span v-if="dueSoonCount > 0">{{ dueSoonCount }} Order/s Due Soon</span>
          <span v-if="dueSoonCount > 0 && overdueCount > 0"> • </span>
          <span v-if="overdueCount > 0">{{ overdueCount }} Order/s Overdue</span>
        </v-alert>
        <v-skeleton-loader v-if="loading" type="table" class="mb-4 neomorphic-card" :loading="loading" />
        <div v-if="!loading && !errorMsg">
          <v-card class="base-list-card base-list-card--teal">
            <v-card-title class="d-flex justify-space-between align-center">
              <span>Order List</span>
              <div class="d-flex align-center gap-2">
                <v-btn variant="tonal" size="small" @click="showFilterDialog = true">
                  <v-icon start size="18">mdi-filter-variant</v-icon>
                  Filters
                  <v-chip v-if="activeFilterCount" size="x-small" color="teal-darken-3" class="ml-1">{{ activeFilterCount }}</v-chip>
                </v-btn>
                <v-btn color="primary" icon size="small" @click="handleAddOrder">
                  <v-icon>mdi-plus</v-icon>
                </v-btn>
              </div>
            </v-card-title>
            <v-data-table-server
              :headers="orderHeaders"
              :items="orders"
              :items-length="totalOrders"
              :loading="tableLoading"
              :sort-by="tableSortBy"
              :page="page"
              :items-per-page="itemsPerPage"
              :items-per-page-options="[10, 25, 50, 100]"
              class="elevation-1"
              @update:options="handleTableOptions"
            >
              <template #item.status="{ item }">
                <span>{{ item.statusLabel || item.status }}</span>
                <v-chip v-if="item.overdue" color="error" size="x-small" class="ml-2" label>Overdue</v-chip>
                <v-chip v-else-if="item.dueSoon" color="warning" size="x-small" class="ml-2" label>Due Soon</v-chip>
              </template>
              <template #item.actions="{ item }">
                <v-btn icon="mdi-pencil" size="small" @click="onEditOrder(item)" />
              </template>
            </v-data-table-server>
          </v-card>

          <!-- Filter modal -->
          <v-dialog v-model="showFilterDialog" max-width="480">
            <v-card class="rounded-xl overflow-hidden">
              <div style="background: #0d3d38;" class="d-flex align-center justify-space-between px-6 py-4">
                <span class="text-base font-semibold text-white">Filter Orders</span>
                <v-btn icon="mdi-close" size="small" variant="text" style="color: rgba(255,255,255,0.8);" @click="showFilterDialog = false" />
              </div>
              <v-card-text class="pt-5 pb-2">
                <div class="mb-4">
                  <div class="text-subtitle-2 mb-1 text-medium-emphasis">Status</div>
                  <v-select
                    v-model="filterStatus"
                    :items="ORDER_STATUSES"
                    item-title="label"
                    item-value="value"
                    placeholder="All statuses"
                    multiple
                    clearable
                    chips
                    variant="outlined"
                    density="compact"
                    hide-details
                  />
                </div>
                <div class="mb-4">
                  <div class="text-subtitle-2 mb-1 text-medium-emphasis">Customer</div>
                  <v-autocomplete
                    v-model="filterCustomerID"
                    :items="customers"
                    item-title="label"
                    item-value="value"
                    placeholder="All customers"
                    clearable
                    variant="outlined"
                    density="compact"
                    hide-details
                  />
                </div>
                <div class="mb-4">
                  <div class="text-subtitle-2 mb-1 text-medium-emphasis">Delivery Date</div>
                  <v-row dense>
                    <v-col cols="6">
                      <v-text-field v-model="filterDeliveryDateFrom" type="date" label="From" variant="outlined" density="compact" hide-details />
                    </v-col>
                    <v-col cols="6">
                      <v-text-field v-model="filterDeliveryDateTo" type="date" label="To" variant="outlined" density="compact" hide-details />
                    </v-col>
                  </v-row>
                </div>
                <div class="mb-2">
                  <div class="text-subtitle-2 mb-1 text-medium-emphasis">Created Date</div>
                  <v-row dense>
                    <v-col cols="6">
                      <v-text-field v-model="filterCreatedDateFrom" type="date" label="From" variant="outlined" density="compact" hide-details />
                    </v-col>
                    <v-col cols="6">
                      <v-text-field v-model="filterCreatedDateTo" type="date" label="To" variant="outlined" density="compact" hide-details />
                    </v-col>
                  </v-row>
                </div>
              </v-card-text>
              <v-card-actions class="px-6 pb-5 pt-2">
                <v-btn variant="outlined" @click="clearFilters">Clear all</v-btn>
                <v-spacer />
                <v-btn variant="flat" style="background: #0f766e; color: #fff;" @click="applyFilters">Apply filters</v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
        </div>
      </section>
      <v-dialog v-model="showCapacityWarning" max-width="480">
        <v-card class="rounded-xl overflow-hidden" style="border: none;">
          <div class="bg-[#0d3d38] text-white px-6 py-4">
            <span class="text-base font-semibold">Capacity warning</span>
          </div>
          <div class="bg-white px-6 pt-4 pb-2 text-gray-700 text-sm">
            <p>
              Current pending workload : <strong>{{ capacityResult?.pendingKg ?? 0 }} kg</strong><br />
              Daily processing capacity : <strong>{{ capacityResult?.capacityPerDayKg ?? 0 }} kg/day</strong>
            </p>
            <p class="mt-3">
              The current workload requires approximately
              <strong>{{ Math.ceil((capacityResult?.pendingKg ?? 0) / (capacityResult?.capacityPerDayKg || 1)) }} processing day(s)</strong>.
            </p>
            <p class="mt-3">
              Adding this order (<strong>{{ capacityResult?.newOrderKg ?? 0 }} kg</strong>) may cause the selected delivery date to be missed.
            </p>
            <p class="mt-3">Do you want to continue with the selected delivery date?</p>
          </div>
          <div class="bg-white flex justify-end gap-3 px-6 pb-4">
            <v-btn variant="outlined"
              style="border-color: #d1d5db; color: #6b7280; text-transform: none;"
              @click="cancelCapacityWarning">Cancel</v-btn>
            <v-btn
              style="background: #0f766e; color: #ffffff; text-transform: none; font-weight: 600;"
              @click="confirmCapacityWarning">Yes, Continue</v-btn>
          </div>
        </v-card>
      </v-dialog>
      <v-dialog v-model="showPaymentAffectWarning" max-width="480">
        <v-card class="rounded-xl overflow-hidden" style="border: none;">
          <div class="bg-[#0d3d38] text-white px-6 py-4">
            <span class="text-base font-semibold">Confirm update</span>
          </div>
          <div class="bg-white px-6 pt-4 pb-2 text-gray-700 text-sm">
            <p>
              This order already contains payments. Updating order items will recalculate the outstanding balance. Do you want to continue?
            </p>
          </div>
          <div class="bg-white flex justify-end gap-3 px-6 pb-4">
            <v-btn variant="outlined"
              style="border-color: #d1d5db; color: #6b7280; text-transform: none;"
              @click="showPaymentAffectWarning = false">Cancel</v-btn>
            <v-btn
              style="background: #0f766e; color: #ffffff; text-transform: none; font-weight: 600;"
              @click="confirmModifyWithPayments">Continue</v-btn>
          </div>
        </v-card>
      </v-dialog>
      <v-dialog v-model="showForm" max-width="900" scrim>
        <template #default>
          <v-card class="rounded-xl overflow-hidden" style="border: none;">
            <div class="bg-[#0d3d38] text-white px-6 py-4 flex items-center justify-between">
              <h3 class="text-lg font-semibold">{{ editOrderId ? 'Edit Order' : 'New Order' }}</h3>
              <v-btn icon="mdi-close" size="small" variant="text"
                style="color: rgba(255,255,255,0.8);" @click="showForm = false" />
            </div>
            <div class="bg-white px-6 pt-6 pb-4" style="max-height: 75vh; overflow-y: auto;">
            <div class="mb-4">
              <v-tabs v-model="activeOrderModalTab" color="#0f766e" density="comfortable">
                <v-tab value="order" style="text-transform: none;">Order</v-tab>
                <v-tab v-if="showNewCustomerTab" value="new-customer" style="text-transform: none;">New Customer</v-tab>
                <v-tab v-if="editOrderId" value="payments" style="text-transform: none;">Payments</v-tab>
              </v-tabs>
            </div>
            <DynamicForm
              v-show="activeOrderModalTab === 'order'"
              :schema="orderFormSchema"
              :form="form"
              :isValid="isValid"
              :onSubmit="handleSubmit"
              :hideDefaultSubmit="true"
            >
              <template #default>
                <div class="field-group mb-4">
                  <label class="field-label">Customer <span class="required-star">*</span></label>
                  <v-autocomplete
                    v-model="form.customer"
                    v-model:search="customerSearchQuery"
                    :items="editOrderId ? customers : customerSearchItems"
                    item-title="label"
                    item-value="value"
                    :custom-filter="customerFilter"
                    placeholder="Search by name or phone number..."
                    variant="outlined"
                    density="compact"
                    hide-details="auto"
                    clearable
                    required
                    :disabled="isOrderDone"
                    :rules="[v => !!v || 'Customer is required']"
                    @update:model-value="onCustomerSelect"
                  >
                    <template #item="{ item, props: itemProps }">
                      <v-list-item
                        v-if="(item as any).raw?.isAction"
                        v-bind="itemProps"
                        title="+ Add New Customer"
                        style="color: #0f766e; font-weight: 600; border-top: 1px solid #f3f4f6;"
                      />
                      <v-list-item v-else v-bind="itemProps">
                        <template #subtitle>
                          <span style="font-size: 12px; color: #6b7280;">{{ (item as any).raw?.mobileNumber }}</span>
                        </template>
                      </v-list-item>
                    </template>
                  </v-autocomplete>
                </div>
                <div v-if="form.customer || editOrderId" class="field-group mb-2">
                  <label class="field-label">Delivery Date <span class="required-star">*</span></label>
                  <v-text-field
                    v-model="form.deliveryDate"
                    type="date"
                    :rules="[v => !!v || 'Delivery date is required']"
                    required
                    :disabled="isOrderDone"
                    variant="outlined"
                    density="compact"
                    hide-details="auto"
                  />
                </div>
              </template>
              <template #suborders>
                <div v-if="form.customer || editOrderId" class="order-suborders-section">
                  <div class="order-suborders-header">
                    <div class="suborders-label">
                      <span>Order Items</span>
                      <span class="suborders-badge">{{ suborders.length }}</span>
                    </div>
                    <v-btn class="add-suborder-btn" @click="addSuborder" variant="outlined"
                      :disabled="isOrderDone"
                      style="border-color: #0f766e; color: #0f766e; text-transform: none;">+ Add Item</v-btn>
                  </div>
                  <div class="suborder-table">
                    <div v-for="(sub, idx) in suborders" :key="idx" class="suborder-row">
                      <div class="field-group suborder-field small-field">
                        <label class="field-label">Category <span class="required-star">*</span></label>
                        <v-select
                          v-model="sub.category"
                          :items="availableCategoriesFor(idx)"
                          item-title="label"
                          item-value="value"
                          placeholder="Select"
                          :rules="[v => !!v || 'Category is required']"
                          variant="outlined"
                          density="compact"
                          hide-details="auto"
                          @change="() => updateSuborderAmount(idx)"
                          :disabled="isOrderDone"
                          required
                        />
                      </div>
                      <div class="field-group suborder-field small-field">
                        <label class="field-label">Weight (kg) <span class="required-star">*</span></label>
                        <v-text-field
                          v-model="sub.weight"
                          placeholder="0"
                          type="number"
                          :rules="[v => !!v || 'Weight is required']"
                          variant="outlined"
                          density="compact"
                          hide-details="auto"
                          @input="() => updateSuborderAmount(idx)"
                          :disabled="isOrderDone"
                          required
                        />
                      </div>
                      <div class="field-group suborder-field small-field">
                        <label class="field-label">Amount</label>
                        <v-text-field
                          :value="sub.amount"
                          placeholder="0"
                          type="number"
                          readonly
                          variant="outlined"
                          density="compact"
                          hide-details="auto"
                        />
                      </div>
                      <div class="delete-btn-wrapper">
                        <span class="delete-btn-spacer"></span>
                        <v-btn icon color="error" size="small" :disabled="isOrderDone" @click="removeSuborder(idx)"><v-icon size="18">mdi-delete</v-icon></v-btn>
                      </div>
                    </div>
                  </div>
                  <v-divider class="order-divider" />
                  <div class="order-total-row">
                    <span class="order-total-label">Subtotal</span>
                    <span class="order-total-amount">LKR {{ totalAmount.toFixed(2) }}</span>
                  </div>
                  <div class="order-discount-row">
                    <span class="order-total-label">Discount</span>
                    <v-text-field
                      v-model="form.discount"
                      type="number"
                      min="0"
                      :max="totalAmount"
                      placeholder="0.00"
                      prefix="LKR"
                      variant="outlined"
                      density="compact"
                      hide-details
                      style="max-width: 180px;"
                      :disabled="isOrderDone"
                      @input="clampDiscount"
                    />
                  </div>
                  <div v-if="Number(form.discount) > 0" class="order-total-row" style="border-top: 2px solid #0f766e; margin-top: 4px; padding-top: 6px;">
                    <span class="order-total-label" style="font-weight: 700;">Total After Discount</span>
                    <span class="order-total-amount" style="color: #0f766e;">LKR {{ finalAmount.toFixed(2) }}</span>
                  </div>
                  <div v-if="!editOrderId" class="mb-3">
                    <v-checkbox
                      v-model="printBillOnCreate"
                      label="Print bill after placing order"
                      color="teal"
                      density="compact"
                      hide-details
                    />
                    <div v-if="printBillOnCreate" class="d-flex align-center ml-6 mt-1 mb-1" style="gap: 8px;">
                      <span style="font-size: 13px; color: #374151;">Copies:</span>
                      <v-text-field
                        v-model.number="printCopies"
                        type="number"
                        min="1"
                        max="10"
                        density="compact"
                        variant="outlined"
                        hide-details
                        style="max-width: 80px;"
                      />
                    </div>
                    <v-checkbox
                      v-model="makePaymentOnCreate"
                      label="Make payment now"
                      color="teal"
                      density="compact"
                      hide-details
                    />
                  </div>
                  <v-btn type="submit" block
                    style="background: #0f766e; color: #fff; text-transform: none; font-weight: 600; height: 44px;">
                    {{ submitButtonLabel }}
                  </v-btn>
                </div>
              </template>
            </DynamicForm>
            <div v-if="showNewCustomerTab && activeOrderModalTab === 'new-customer'" class="pa-2">
              <div style="font-size: 13px; color: #6b7280; margin-bottom: 16px;">
                Enter customer details to register and continue with the order.
              </div>
              <div class="order-form-row" style="margin-bottom: 12px;">
                <div class="order-form-field">
                  <div class="field-group">
                    <label class="field-label">Title <span class="required-star">*</span></label>
                    <v-select v-model="newCustomerForm.title" :items="['Mr','Mrs','Miss','Dr']" variant="outlined" density="compact" hide-details="auto" placeholder="Title" />
                  </div>
                </div>
                <div class="order-form-field">
                  <div class="field-group">
                    <label class="field-label">First Name <span class="required-star">*</span></label>
                    <v-text-field v-model="newCustomerForm.firstName" variant="outlined" density="compact" hide-details="auto" placeholder="First name" />
                  </div>
                </div>
                <div class="order-form-field">
                  <div class="field-group">
                    <label class="field-label">Last Name</label>
                    <v-text-field v-model="newCustomerForm.lastName" variant="outlined" density="compact" hide-details="auto" placeholder="Last name" />
                  </div>
                </div>
              </div>
              <div class="order-form-row" style="margin-bottom: 12px;">
                <div class="order-form-field">
                  <div class="field-group">
                    <label class="field-label">Mobile Number <span class="required-star">*</span></label>
                    <v-text-field v-model="newCustomerForm.mobileNumber" variant="outlined" density="compact" hide-details="auto" placeholder="Mobile number" :rules="MOBILE_RULES" />
                  </div>
                </div>
                <div class="order-form-field">
                  <div class="field-group">
                    <label class="field-label">Postal Code</label>
                    <v-text-field v-model="newCustomerForm.postalCode" variant="outlined" density="compact" hide-details="auto" placeholder="Postal code" />
                  </div>
                </div>
              </div>
              <div class="field-group" style="margin-bottom: 12px;">
                <label class="field-label">Address Line 1</label>
                <v-text-field v-model="newCustomerForm.addressLine1" variant="outlined" density="compact" hide-details="auto" placeholder="Address line 1" />
              </div>
              <div class="field-group" style="margin-bottom: 12px;">
                <label class="field-label">Address Line 2</label>
                <v-text-field v-model="newCustomerForm.addressLine2" variant="outlined" density="compact" hide-details="auto" placeholder="Address line 2 (optional)" />
              </div>
              <div class="order-form-row" style="margin-bottom: 16px;">
                <div class="order-form-field">
                  <div class="field-group">
                    <label class="field-label">City</label>
                    <v-text-field v-model="newCustomerForm.city" variant="outlined" density="compact" hide-details="auto" placeholder="City" />
                  </div>
                </div>
                <div class="order-form-field">
                  <div class="field-group">
                    <label class="field-label">State</label>
                    <v-text-field v-model="newCustomerForm.state" variant="outlined" density="compact" hide-details="auto" placeholder="State" />
                  </div>
                </div>
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid #f3f4f6; padding-top: 16px;">
                <v-btn
                  variant="outlined"
                  style="border-color: #d1d5db; color: #6b7280; text-transform: none;"
                  @click="activeOrderModalTab = 'order'"
                >Back to Order</v-btn>
                <v-btn
                  :disabled="!newCustomerFormValid"
                  :loading="savingNewCustomer"
                  style="background: #0f766e; color: #fff; text-transform: none; font-weight: 600;"
                  @click="onSaveNewCustomer"
                >{{ newCustomerId ? 'Update Customer' : 'Add Customer' }}</v-btn>
              </div>
            </div>
            <template v-if="editOrderId">
              <div v-show="activeOrderModalTab === 'payments'">
              <v-divider class="mt-4 mb-3" />
              <div class="payments-section">
                <div v-if="payments.length > 0">
                  <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Payments Made</div>
                  <div v-for="(p, idx) in payments" :key="idx" class="payment-row">
                    <span class="payment-date">{{ p.date ? new Date(p.date).toLocaleString() : '' }}</span>
                    <span class="payment-method">{{ PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod }}</span>
                    <span class="payment-amount">LKR {{ Number(p.amount).toFixed(2) }}</span>
                  </div>
                  <v-divider class="my-3" />
                </div>
                <div class="due-row">
                  <span class="text-sm font-medium text-gray-600">Due Amount</span>
                  <span class="text-base font-bold" :style="{ color: effectiveDueAmount > 0 ? '#b45309' : '#0f766e' }">
                    LKR {{ effectiveDueAmount.toFixed(2) }}
                  </span>
                </div>
                <v-btn
                  v-if="canMakePayment"
                  block
                  class="mt-3"
                  style="background: #0f766e; color: #ffffff; text-transform: none; font-weight: 600; height: 40px;"
                  @click="showPaymentDialog = true"
                >
                  {{ paymentButtonLabel }}
                </v-btn>
                <v-alert
                  v-else
                  type="success"
                  variant="tonal"
                  class="mt-3"
                >
                  Payment completed
                </v-alert>
              </div>
              </div>
            </template>
            </div>
          </v-card>
        </template>
      </v-dialog>

      <!-- OTP verification for inline new-customer registration -->
      <v-dialog v-model="showNewCustomerOtpDialog" max-width="400">
        <template #default>
          <v-card class="rounded-xl overflow-hidden">
            <div class="bg-[#0d3d38] text-white px-6 py-4">
              <h3 class="text-lg font-semibold">Verify Mobile</h3>
            </div>
            <div class="bg-white px-6 pt-6 pb-4">
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Enter OTP</label>
                <v-text-field v-model="newCustomerOtpCode" placeholder="123456" variant="outlined" density="compact" hide-details="auto" />
              </div>
              <div class="flex justify-between items-center pt-4 border-t border-gray-100">
                <v-btn variant="text" :loading="resendingOtp" style="color: #0f766e; text-transform: none; font-weight: 600;" @click="resendNewCustomerOtp">Resend OTP</v-btn>
                <div class="flex gap-3">
                  <v-btn variant="outlined" style="border-color: #d1d5db; color: #6b7280; text-transform: none;" @click="showNewCustomerOtpDialog = false">Cancel</v-btn>
                  <v-btn :loading="verifyingOtp" style="background: #0f766e; color: #fff; text-transform: none; font-weight: 600;" @click="verifyNewCustomerOtp">Verify</v-btn>
                </div>
              </div>
            </div>
          </v-card>
        </template>
      </v-dialog>

      <OrderPaymentDialog
        v-if="editOrderId"
        :show="showPaymentDialog"
        :order-id="editOrderId"
        :due-amount="effectiveDueAmount"
        @close="showPaymentDialog = false"
        @paid="onPaymentMade"
      />
    </main>
  </div>
</template>

<script lang="ts" setup>

import { ref, computed, watch } from 'vue'
import BaseList from '@/components/BaseList.vue'
import DynamicForm from '@/components/DynamicForm.vue'
import OrderPaymentDialog from './OrderPaymentDialog.vue'
import { useDynamicForm } from '@/composables/useDynamicForm'
import { getActiveCashBoxSession } from '../services/cashBoxSessionApiService'
import { useAuth } from '../composables/useAuth'
const { getUser } = useAuth()

const orderHeaders = [
  { title: 'Order #',       key: 'orderNo',      align: 'start' as const, sortable: true },
  { title: 'Customer',      key: 'customer',     align: 'start' as const, sortable: true },
  { title: 'Status',        key: 'status',       align: 'start' as const, sortable: true },
  { title: 'Delivery Date', key: 'deliveryDate', align: 'start' as const, sortable: true },
  { title: 'Created Date',  key: 'createdDate',  align: 'start' as const, sortable: true },
  { title: 'Total',         key: 'totalAmount',  align: 'end'   as const, sortable: true },
  { title: 'Payment Status',key: 'paymentStatus',align: 'end'   as const, sortable: true },
  { title: 'Actions',       key: 'actions',      align: 'end'   as const, sortable: false },
]

import { getOrders, getOrderById, updateOrder } from '@/services/orderApiService'
import { getPaymentsByOrder } from '../services/getPaymentsByOrder'
import { checkOrderCapacity, getSystemSettings, type CapacityCheckResult } from '@/services/systemSettingsApiService'
const payments = ref<any[]>([])
const dueAmount = computed(() => {
  const paid = payments.value.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  return totalAmount.value - paid
})
const currentOrderDueAmount = ref(0)
const currentOrderPaymentStatus = ref('unpaid')
const effectiveDueAmount = computed(() => {
  if (!editOrderId.value) return Math.max(dueAmount.value, 0)
  return Math.max(Number(currentOrderDueAmount.value || 0), 0)
})
const canMakePayment = computed(() => {
  if (!editOrderId.value) return false
  if (String(currentOrderPaymentStatus.value || '').toLowerCase() === 'paid') return false
  return effectiveDueAmount.value > 0
})

const orders = ref<any[]>([])
const totalOrders = ref(0)
const page = ref(1)
const itemsPerPage = ref(10)
const sortKey = ref('orderNo')
const sortOrder = ref<'asc' | 'desc'>('desc')
const tableLoading = ref(false)

const searchQuery = ref('')
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    page.value = 1
    loadOrders()
  }, 300)
})

const filterStatus = ref<string[]>([])
const filterDeliveryDateFrom = ref('')
const filterDeliveryDateTo = ref('')
const filterCustomerID = ref<string | null>('')
const filterCreatedDateFrom = ref('')
const filterCreatedDateTo = ref('')
const showFilterDialog = ref(false)

const activeFilterCount = computed(() => {
  let n = 0
  if (filterStatus.value.length) n++
  if (filterCustomerID.value) n++
  if (filterDeliveryDateFrom.value || filterDeliveryDateTo.value) n++
  if (filterCreatedDateFrom.value || filterCreatedDateTo.value) n++
  return n
})

const tableSortBy = computed(() =>
  sortKey.value ? [{ key: sortKey.value, order: sortOrder.value }] : []
)

const showForm = ref(false)
const editOrderId = ref<string|null>(null)
const activeOrderModalTab = ref<'order' | 'payments' | 'new-customer'>('order')

const customerSearchQuery = ref('')

const newCustomerForm = ref({
  title: '',
  firstName: '',
  lastName: '',
  mobileNumber: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
})
const savingNewCustomer = ref(false)
const MOBILE_RULES = [(v: string) => /^\d{10}$/.test(v) || 'Must be exactly 10 digits']

// OTP verification for the inline "Add New Customer" flow (mirrors the Customers tab)
const showNewCustomerOtpDialog = ref(false)
const newCustomerOtpCode = ref('')
const otpMobile = ref('')
const verifyingOtp = ref(false)
const resendingOtp = ref(false)
// Once a customer is created inline, the tab switches to "update" mode for that
// customer (id set) so edits save directly without re-running OTP.
const newCustomerId = ref<string | null>(null)

const newCustomerFormValid = computed(() => {
  const f = newCustomerForm.value
  return !!(f.title && f.firstName && /^\d{10}$/.test(f.mobileNumber))
})

// Show the New Customer tab only when registering a customer for this order:
// hidden once an existing customer is picked, but kept while a just-added
// customer (update mode) is selected so it can still be edited.
const showNewCustomerTab = computed(() => !editOrderId.value && (!form.value.customer || !!newCustomerId.value))

const customerSearchItems = computed(() => [
  ...customers.value,
  { label: '+ Add New Customer', value: '__add_new__', mobileNumber: '', isAction: true }
])

function customerFilter(_value: string, query: string, item?: any): boolean {
  if (item?.raw?.isAction) return true
  if (!query) return true
  const q = query.toLowerCase()
  const label = (item?.raw?.label || '').toLowerCase()
  const phone = (item?.raw?.mobileNumber || '').toLowerCase()
  return label.includes(q) || phone.includes(q)
}

function onCustomerSelect(val: any) {
  if (val === '__add_new__') {
    form.value.customer = ''
    goToNewCustomerTab()
  }
}
const showPaymentDialog = ref(false)
const categories = ref<any[]>([])
const suborders = ref<any[]>([])
const printBillOnCreate = ref(true)
const printCopies = ref(1)
const makePaymentOnCreate = ref(false)
const showCapacityWarning = ref(false)
const capacityResult = ref<CapacityCheckResult | null>(null)
const showPaymentAffectWarning = ref(false)
const originalSubordersSnapshot = ref('')
const dueSoonLeadDays = ref<number>(1)
const overdueCount = computed(() => orders.value.filter(o => o.overdue).length)
const dueSoonCount = computed(() => orders.value.filter(o => o.dueSoon).length)

function addSuborder() {
  suborders.value.push({ category: '', weight: '', amount: 0 })
}
function removeSuborder(idx: number) {
  suborders.value.splice(idx, 1)
}
function updateSuborderAmount(idx: number) {
  const sub = suborders.value[idx]
  // Items loaded from an existing (already placed) order keep the amount that was
  // stored when the order was placed — their category/weight inputs are always
  // disabled, so they can never change. Only newly added items are priced with the
  // current category rates. This keeps historical orders showing their original
  // pricing even after a category's unitPrice/minimumPrice is modified.
  if (sub.originalAmount != null) {
    sub.amount = sub.originalAmount
    return
  }
  const cat = categories.value.find((c: any) => c.value === sub.category)
  if (cat && sub.weight) {
    const computed = Number(sub.weight) * Number(cat.unitPrice)
    const floor = Number(cat.minimumPrice) || 0
    sub.amount = Math.max(computed, floor)
  } else {
    sub.amount = 0
  }
}

function availableCategoriesFor(idx: number) {
  const selectedElsewhere = new Set(
    suborders.value.filter((_, i) => i !== idx).map(s => s.category).filter(Boolean)
  )
  return categories.value.filter((c: any) => !selectedElsewhere.has(c.value))
}
const totalAmount = computed(() => suborders.value.reduce((sum, s) => sum + Number(s.amount || 0), 0))
const finalAmount = computed(() => Math.max(totalAmount.value - Number(form.value.discount || 0), 0))

function clampDiscount() {
  const d = Number(form.value.discount)
  if (isNaN(d) || d < 0) { form.value.discount = 0; return }
  if (d > totalAmount.value) form.value.discount = totalAmount.value
}

// Watch suborders for changes to recalculate amounts
watch(suborders, (subs) => {
  subs.forEach((sub, idx) => updateSuborderAmount(idx))
}, { deep: true })
import { makePayment } from '@/services/paymentApiService'
async function onPaymentMade(payment: any) {
  // Call payment API
  try {
    const activeSession = await getActiveCashBoxSession();
    const user = getUser();
    
    // Validate that both session and user exist before allowing payment
    if (!activeSession) {
      showToast('No active cash box session. Please open one first.', 'warning');
      return;
    }
    if (!user) {
      showToast('User information not found. Please log in again.', 'warning');
      return;
    }
    
    await makePayment({
      orderId: editOrderId.value || '',
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      type: payment.type,
      sessionId: activeSession._id,
      userId: user._id,
      transactionId: payment.transactionId,
    })
    
    showToast('Payment successful!', 'success')
    
    // Reload payments to update due amount
    payments.value = await getPaymentsByOrder(editOrderId.value || '')
    const latestOrder = await getOrderById(editOrderId.value || '')
    currentOrderDueAmount.value = Number(latestOrder?.dueAmount || 0)
    currentOrderPaymentStatus.value = String(latestOrder?.paymentStatus || 'unpaid')
    
    // If this payment was initiated as part of a create+pay flow, print the bill now
    if (makePaymentOnCreate.value) {
      try {
        // Use authoritative order returned from server to render bill
        await printBill(latestOrder, printCopies.value)
      } catch (e) {
        console.error('Print after payment failed', e)
      }
      // clear the flag so subsequent payments don't auto-print
      makePaymentOnCreate.value = false
    }

    // Check if order is fully paid and refresh orders
    if (effectiveDueAmount.value <= 0) {
      showToast('Payment status updated to paid.', 'success')
    }
    await loadOrders()
    showPaymentDialog.value = false
  } catch (e) {
    showToast('Payment failed', 'error')
  }
}

import { onMounted } from 'vue'
import { getAllCustomers, sendOtp, verifyOtp, updateCustomer } from '@/services/customerApiService'
import { createOrder } from '@/services/orderApiService'
import { useToast } from '@/composables/useToast'
const { toast, showToast } = useToast()

const customers = ref<Array<{ label: string; value: string; mobileNumber: string; title?: string }>>([])

const loading = ref(false)
const errorMsg = ref('')

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank Transfer',
}

const ORDER_STATUSES = [
  { label: 'To Do', value: 'todo' },
  { label: 'Done', value: 'done' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Delivered', value: 'delivered' },
]

const orderFormSchema = computed(() => ({
  fields: [
    ...(editOrderId.value ? [
      { name: 'status', label: 'Status', type: 'select', required: true, options: ORDER_STATUSES },
      { name: 'rackNumber', label: 'Rack Number', type: 'text' },
    ] : [])
  ]
}))

const isOrderDone = computed(() => {
  const s = String(form.value.status || '').toLowerCase()
  return s === 'todo'|| s === 'done' || s === 'delivered' || s === 'cancelled' 
})

import type { CustomerPayload } from '@/services/customerApiService'


import { getAllCategories } from '@/services/categoryApiService'
async function loadCustomersAndOrders() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [customerData, orderResult, categoryData, settings] = await Promise.all([
      getAllCustomers(),
      getOrders({ page: page.value, limit: itemsPerPage.value, sortBy: sortKey.value, sortOrder: sortOrder.value }),
      getAllCategories(),
      getSystemSettings().catch(() => null)
    ])
    if (settings) {
      dueSoonLeadDays.value = Number(settings.dueSoonLeadDays) || 0
    }
    customers.value = (customerData || []).map((c: CustomerPayload & { _id: string }) => ({ label: [c.firstName, c.lastName].filter(Boolean).join(' '), value: c._id, mobileNumber: c.mobileNumber, title: c.title }))
    if (Array.isArray(categoryData)) {
      categories.value = categoryData.map((cat: any) => ({
        label: cat.name,
        value: cat._id,
        unitPrice: cat.unitPrice,
        minimumPrice: cat.minimumPrice,
      }))
    } else {
      categories.value = []
      console.error('Failed to load categories:', categoryData)
    }
    console.log('[OrderList] orderResult:', orderResult)
    totalOrders.value = orderResult.total
    setOrdersFromData(orderResult.orders)
    console.log('[OrderList] orders after set:', orders.value.length)
  } catch (err) {
    errorMsg.value = 'Failed to load orders or related data. Please try again.'
    console.error('Data load error:', err)
  } finally {
    loading.value = false
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

function deliveryState(order: any): { overdue: boolean; dueSoon: boolean } {
  if (!order?.deliveryDate) return { overdue: false, dueSoon: false }
  if (order.status === 'done' || order.status === 'cancelled' || order.status === 'delivered') return { overdue: false, dueSoon: false }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(order.deliveryDate)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / DAY_MS)
  if (diffDays < 0) return { overdue: true, dueSoon: false }
  if (diffDays <= Math.max(0, Number(dueSoonLeadDays.value) || 0)) return { overdue: false, dueSoon: true }
  return { overdue: false, dueSoon: false }
}

function setOrdersFromData(orderData: any[]) {
  orders.value = (orderData || []).map((order: any) => {
    const { overdue, dueSoon } = deliveryState(order)
    const paymentStatusRaw = String(order.paymentStatus || '').toLowerCase()
    let paymentStatus = 'Not Paid'
    if (paymentStatusRaw === 'paid') paymentStatus = 'Paid'
    else if (paymentStatusRaw === 'partial') paymentStatus = 'Partially Paid'

    return {
      id: order._id,
      orderNo: order.orderNo || order._id,
      customer: customers.value.find(c => c.value === (order.customerID?._id || order.customerID))?.label || order.customerID,
      status: order.status,
      statusLabel: (ORDER_STATUSES.find(s => s.value === order.status) || { label: order.status }).label,
      deliveryDate: order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : '—',
      createdDate: order.createdDate ? new Date(order.createdDate).toLocaleDateString() : '—',
      totalAmount: typeof order.totalAmount === 'number' ? `Rs ${order.totalAmount.toFixed(2)}` : order.totalAmount,
      paymentStatus,
      overdue,
      dueSoon,
    }
  })
}

async function loadOrders() {
  if (tableLoading.value) return
  tableLoading.value = true
  try {
    const result = await getOrders({
      page: page.value,
      limit: itemsPerPage.value,
      sortBy: sortKey.value,
      sortOrder: sortOrder.value,
      status: filterStatus.value.length ? filterStatus.value.join(',') : undefined,
      deliveryDateFrom: filterDeliveryDateFrom.value || undefined,
      deliveryDateTo: filterDeliveryDateTo.value || undefined,
      customerID: filterCustomerID.value || undefined,
      createdDateFrom: filterCreatedDateFrom.value || undefined,
      createdDateTo: filterCreatedDateTo.value || undefined,
      search: searchQuery.value || undefined,
    })
    totalOrders.value = result.total
    setOrdersFromData(result.orders)
  } catch (err) {
    errorMsg.value = 'Failed to load orders. Please try again.'
    console.error('loadOrders error:', err)
  } finally {
    tableLoading.value = false
  }
}

function applyFilters() {
  showFilterDialog.value = false
  page.value = 1
  loadOrders()
}

function clearFilters() {
  filterStatus.value = []
  filterDeliveryDateFrom.value = ''
  filterDeliveryDateTo.value = ''
  filterCustomerID.value = ''
  filterCreatedDateFrom.value = ''
  filterCreatedDateTo.value = ''
  page.value = 1
  loadOrders()
}

function handleTableOptions(options: any) {
  const newPage: number = options.page ?? page.value
  const newLimit: number = options.itemsPerPage ?? itemsPerPage.value
  const sort = options.sortBy?.[0]
  const newSortKey: string = sort?.key ?? sortKey.value
  const newSortOrder: 'asc' | 'desc' = sort?.order ?? sortOrder.value

  if (
    newPage === page.value &&
    newLimit === itemsPerPage.value &&
    newSortKey === sortKey.value &&
    newSortOrder === sortOrder.value
  ) return

  page.value = newPage
  itemsPerPage.value = newLimit
  sortKey.value = newSortKey
  sortOrder.value = newSortOrder
  loadOrders()
}

onMounted(loadCustomersAndOrders)

const { form, isValid } = useDynamicForm({ fields: [] })
// Initialize all possible fields upfront
form.value.customer = ''
form.value.weight = ''
form.value.deliveryDate = ''
form.value.totalAmount = ''
form.value.discount = 0
form.value.status = ''
form.value.rackNumber = ''

function resetForm() {
  form.value.customer = ''
  form.value.deliveryDate = ''
  form.value.discount = 0
  form.value.status = ''
  form.value.rackNumber = ''
  suborders.value = []
  payments.value = []
  currentOrderDueAmount.value = 0
  currentOrderPaymentStatus.value = 'unpaid'
  activeOrderModalTab.value = 'order'
  printBillOnCreate.value = true
  printCopies.value = 1
  makePaymentOnCreate.value = false
  customerSearchQuery.value = ''
  newCustomerId.value = null
  newCustomerForm.value = {
    title: '',
    firstName: '',
    lastName: '',
    mobileNumber: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
  }
}

const submitButtonLabel = computed(() => {
  if (!editOrderId.value && makePaymentOnCreate.value) return 'Next'
  if (editOrderId.value) return 'Update order'
  return 'Submit order'
})

const paymentButtonLabel = computed(() => {
  return makePaymentOnCreate.value ? 'Submit Payment' : 'Make Payment'
})

function escapeHtml(value: any) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatMoney(value: number) {
  return `LKR ${Number(value || 0).toFixed(2)}`
}

function resolveCustomerName(customerId: any) {
  const id = typeof customerId === 'string' ? customerId : customerId?._id
  const selected = customers.value.find((c: any) => c.value === id)
  return selected ? ([selected.title, selected.label].filter(Boolean).join(' ') || 'Walk-in Customer') : 'Walk-in Customer'
}

function resolveCustomerPhone(customerId: any): string {
  const id = typeof customerId === 'string' ? customerId : customerId?._id
  const selected = customers.value.find((c: any) => c.value === id)
  return selected?.mobileNumber || ''
}

function buildPrintBillHtml(order: any) {
  const created = order?.createdDate ? new Date(order.createdDate) : new Date()
  const delivery = order?.deliveryDate ? new Date(order.deliveryDate) : null
  const orderItems = Array.isArray(order?.suborders) ? order.suborders : []
  const orderId = order?.orderNo || order?._id || 'N/A'
  const customerName = resolveCustomerName(order?.customerID)
  const customerPhone = resolveCustomerPhone(order?.customerID)
  const subtotal = Number(order?.totalAmount ?? totalAmount.value ?? 0)
  const discount = Number(order?.discount ?? form.value.discount ?? 0)
  const netTotal = Math.max(subtotal - discount, 0)
  const dueAmt = Number(order?.dueAmount ?? netTotal)
  const paidAmt = Math.max(netTotal - dueAmt, 0)

  const rows = orderItems.map((item: any, index: number) => {
    const categoryName = item?.category?.name || categories.value.find((c: any) => c.value === item?.category)?.label || 'Item'
    const weight = Number(item?.weight || 0)
    const amount = Number(item?.amount || 0)
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(categoryName)}</td>
        <td style="text-align:right;">${weight.toFixed(2)}</td>
        <td style="text-align:right;">${amount.toFixed(2)}</td>
      </tr>
    `
  }).join('')

  const discountRow = discount > 0 ? `
    <div class="summary-row">
      <span>Subtotal</span>
      <span>${escapeHtml(formatMoney(subtotal))}</span>
    </div>
    <div class="summary-row discount">
      <span>Discount</span>
      <span>- ${escapeHtml(formatMoney(discount))}</span>
    </div>
    <div class="divider"></div>
  ` : ''

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Order Bill ${escapeHtml(orderId)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #111827; }
          .bill { width: 80mm; margin: 0 auto; padding: 10px; }
          .center { text-align: center; }
          .muted { color: #6b7280; font-size: 12px; }
          .title { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
          .section { margin-top: 10px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { padding: 4px 0; border-bottom: 1px dashed #d1d5db; }
          th { text-align: left; font-weight: 600; }
          .summary-row { margin-top: 4px; font-size: 13px; display: flex; justify-content: space-between; }
          .summary-row.discount { color: #b45309; }
          .summary-row.paid { color: #111827; }
          .divider { border-top: 1px dashed #d1d5db; margin: 4px 0; }
          .total { margin-top: 4px; font-size: 14px; font-weight: 700; display: flex; justify-content: space-between; }
          .balance { margin-top: 4px; font-size: 14px; display: flex; justify-content: space-between; color: #111827; }
          .footer { margin-top: 10px; text-align: center; font-size: 11px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="bill">
          <div class="center">
            <div class="title">Softwash</div>
            <div class="muted">Laundry Order Receipt</div>
          </div>

          <div class="section muted">Order: ${escapeHtml(orderId)}</div>
          <div class="muted">Date: ${escapeHtml(created.toLocaleString())}</div>
          <div class="muted">Customer: ${escapeHtml(customerName)}</div>
          ${customerPhone ? `<div class="muted">Contact: ${escapeHtml(customerPhone)}</div>` : ''}
          <div class="muted">Delivery: ${escapeHtml(delivery ? delivery.toLocaleDateString() : '-')}</div>

          <div class="section">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th style="text-align:right;">Kg</th>
                  <th style="text-align:right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${rows || '<tr><td colspan="4" class="muted">No items</td></tr>'}
              </tbody>
            </table>
          </div>

          ${discountRow}
          <div class="total">
            <span>Total</span>
            <span>${escapeHtml(formatMoney(netTotal))}</span>
          </div>
          ${paidAmt > 0 ? `
          <div class="divider"></div>
          <div class="summary-row paid">
            <span>Paid</span>
            <span>${escapeHtml(formatMoney(paidAmt))}</span>
          </div>
          <div class="balance">
            <span>Balance Due</span>
            <span>${escapeHtml(formatMoney(dueAmt))}</span>
          </div>
          ` : ''}

          <div class="footer">Thank you for your order</div>
        </div>
      </body>
    </html>
  `
}

async function printBill(order: any, copies = 1) {
  const htmlContent = buildPrintBillHtml(order)
  const electronStore = (window as any).electronStore
  if (electronStore?.printBill) {
    try {
      await electronStore.printBill(htmlContent, copies)
      showToast('Bill sent to printer!', 'success')
    } catch (e) {
      console.error('Auto-print failed:', e)
      showToast('Printing failed. Please check printer connection.', 'error')
    }
    return
  }
  // Fallback for non-Electron context
  const billWindow = window.open('', '_blank', 'width=420,height=720')
  if (!billWindow) {
    showToast('Unable to open print preview. Please check pop-up settings.', 'warning')
    return
  }
  billWindow.document.open()
  billWindow.document.write(htmlContent)
  billWindow.document.close()
  billWindow.focus()
  billWindow.onload = () => {
    billWindow.print()
    billWindow.onafterprint = () => billWindow.close()
  }
}

async function onEditOrder(order: any) {
  const orderId = order.id || order._id
  if (!orderId) return
  const data = await getOrderById(orderId)
  editOrderId.value = orderId
  activeOrderModalTab.value = 'order'
  form.value.customer = data.customerID?._id || data.customerID
  form.value.deliveryDate = data.deliveryDate?.substring(0, 10)
  form.value.discount = Number(data.discount || 0)
  form.value.status = data.status || 'todo'
  form.value.rackNumber = data.rackNumber || ''
  currentOrderDueAmount.value = Number(data.dueAmount || 0)
  currentOrderPaymentStatus.value = String(data.paymentStatus || 'unpaid')
  // Map suborders keeping each item's ORIGINAL stored amount. Category prices
  // (unitPrice/minimumPrice) may have changed since the order was placed, so we
  // must not recompute from current prices here — doing so would show amounts
  // that no longer match the payment/due amount recorded for this order.
  // originalAmount marks an item as coming from a placed order so
  // updateSuborderAmount preserves its stored amount instead of re-pricing it.
  const mapped = (data.suborders || []).map((sub: any) => {
    const categoryId = sub.category?._id || sub.category;
    const weight = sub.weight ?? '';
    const amount = Number(sub.amount || 0);
    return {
      category: categoryId,
      weight,
      amount,
      originalAmount: amount,
    };
  });
  suborders.value = mapped;
  // Save a normalized snapshot for change detection when editing
  try {
    const norm = mapped.map((s: any) => ({ category: String(s.category), weight: String(s.weight) }))
    norm.sort((a: any, b: any) => (a.category + '_' + a.weight).localeCompare(b.category + '_' + b.weight))
    originalSubordersSnapshot.value = JSON.stringify(norm)
  } catch (e) {
    originalSubordersSnapshot.value = ''
  }
  // Fetch payments for this order
  payments.value = await getPaymentsByOrder(orderId)
  showForm.value = true
}

async function persistOrder() {
  const payload = {
    customerID: form.value.customer,
    deliveryDate: form.value.deliveryDate,
    suborders: suborders.value,
    totalAmount: totalAmount.value,
    discount: Number(form.value.discount || 0),
  };
  if (editOrderId.value) {
    const editPayload = { ...payload, status: form.value.status, rackNumber: form.value.rackNumber }
    await updateOrder(editOrderId.value, editPayload)
    showToast('Order updated successfully!', 'success')
    return
  } else {
    const createdOrder = await createOrder(payload)
    showToast('Order created successfully!', 'success')
    if (printBillOnCreate.value) {
      // If the user requested to make payment now, defer printing until after payment completes
      if (!makePaymentOnCreate.value) {
        await printBill(createdOrder, printCopies.value)
      }
    }
    return createdOrder
  }
}

async function afterOrderPersist(createdOrder?: any) {
  if (createdOrder && makePaymentOnCreate.value) {
    editOrderId.value = createdOrder._id
    currentOrderDueAmount.value = Number(createdOrder.dueAmount ?? createdOrder.totalAmount ?? totalAmount.value ?? 0)
    currentOrderPaymentStatus.value = String(createdOrder.paymentStatus || 'unpaid')
    payments.value = []
    activeOrderModalTab.value = 'payments'
    showForm.value = true
    showPaymentDialog.value = true
    await loadOrders()
    return
  }

  await loadOrders()
  showForm.value = false
  editOrderId.value = null
}

async function handleSubmit() {
  try {
    if (!editOrderId.value && form.value.deliveryDate) {
      const totalKg = suborders.value.reduce((sum, s) => sum + (Number(s.weight) || 0), 0)
      try {
        const result = await checkOrderCapacity({
          deliveryDate: form.value.deliveryDate,
          weightKg: totalKg
        })
        if (!result.ok) {
          capacityResult.value = result
          showCapacityWarning.value = true
          return
        }
      } catch (e) {
        showToast('Capacity check unavailable; proceeding without it.', 'warning')
        console.error('Capacity check failed', e)
      }
    }
    // If editing an existing order that already has payments and items changed, warn the user
    if (editOrderId.value && payments.value.length > 0 && subordersChanged()) {
      showPaymentAffectWarning.value = true
      return
    }
    const createdOrder = await persistOrder()
    await afterOrderPersist(createdOrder)
  } catch (error) {
    showToast(editOrderId.value ? 'Order update failed' : 'Order creation failed', 'error');
    console.error('Order save failed', error);
  }
}

function cancelCapacityWarning() {
  showCapacityWarning.value = false
  capacityResult.value = null
}

async function confirmCapacityWarning() {
  showCapacityWarning.value = false
  capacityResult.value = null
  try {
    const createdOrder = await persistOrder()
    await afterOrderPersist(createdOrder)
  } catch (error) {
    showToast('Order creation failed', 'error')
    console.error('Order save failed', error)
  }
}

function subordersChanged() {
  try {
    const incoming = suborders.value.map((s: any) => ({ category: String(s.category), weight: String(s.weight) }))
    incoming.sort((a: any, b: any) => (a.category + '_' + a.weight).localeCompare(b.category + '_' + b.weight))
    const inc = JSON.stringify(incoming)
    return inc !== originalSubordersSnapshot.value
  } catch (e) {
    return true
  }
}

async function confirmModifyWithPayments() {
  showPaymentAffectWarning.value = false
  try {
    const createdOrder = await persistOrder()
    await afterOrderPersist(createdOrder)
  } catch (error) {
    showToast('Order update failed', 'error')
    console.error('Order save failed', error)
  }
}


function goToNewCustomerTab() {
  const searchVal = customerSearchQuery.value.trim()
  newCustomerId.value = null
  newCustomerForm.value = {
    title: '',
    firstName: '',
    lastName: '',
    mobileNumber: /^\d+$/.test(searchVal) ? searchVal : '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
  }
  activeOrderModalTab.value = 'new-customer'
}

// Save button on the New Customer tab: register a new customer (OTP) or, once
// one has been registered inline, update it directly.
function onSaveNewCustomer() {
  if (newCustomerId.value) updateNewCustomer()
  else handleAddNewCustomer()
}

async function handleAddNewCustomer() {
  if (!newCustomerFormValid.value) return
  savingNewCustomer.value = true
  try {
    otpMobile.value = newCustomerForm.value.mobileNumber
    await sendOtp(otpMobile.value, newCustomerForm.value)
    showNewCustomerOtpDialog.value = true
    showToast('OTP sent to mobile number. Please verify.', 'info')
  } catch (e) {
    showToast('Failed to send OTP. Please try again.', 'error')
  } finally {
    savingNewCustomer.value = false
  }
}

async function updateNewCustomer() {
  if (!newCustomerFormValid.value || !newCustomerId.value) return
  savingNewCustomer.value = true
  try {
    const saved = await updateCustomer(newCustomerId.value, newCustomerForm.value)
    const opt = { label: [saved.firstName, saved.lastName].filter(Boolean).join(' '), value: saved._id, mobileNumber: saved.mobileNumber, title: saved.title }
    const idx = customers.value.findIndex(c => c.value === saved._id)
    if (idx !== -1) customers.value[idx] = opt
    else customers.value = [...customers.value, opt]
    form.value.customer = saved._id
    activeOrderModalTab.value = 'order'
    showToast('Customer updated successfully!', 'success')
  } catch {
    showToast('Failed to update customer. Please try again.', 'error')
  } finally {
    savingNewCustomer.value = false
  }
}

async function resendNewCustomerOtp() {
  if (!otpMobile.value) return
  resendingOtp.value = true
  try {
    await sendOtp(otpMobile.value, newCustomerForm.value)
    newCustomerOtpCode.value = ''
    showToast('A new OTP has been sent.', 'info')
  } catch {
    showToast('Failed to resend OTP. Please try again.', 'error')
  } finally {
    resendingOtp.value = false
  }
}

async function verifyNewCustomerOtp() {
  verifyingOtp.value = true
  try {
    const saved = await verifyOtp(otpMobile.value, newCustomerOtpCode.value)
    customers.value = [...customers.value, { label: [saved.firstName, saved.lastName].filter(Boolean).join(' '), value: saved._id, mobileNumber: saved.mobileNumber, title: saved.title }]
    form.value.customer = saved._id
    showNewCustomerOtpDialog.value = false
    newCustomerOtpCode.value = ''
    // Keep the saved data on the New Customer tab and switch it to "update" mode,
    // so returning to it edits this customer directly instead of creating a duplicate.
    newCustomerId.value = saved._id
    newCustomerForm.value = {
      title: saved.title || '',
      firstName: saved.firstName || '',
      lastName: saved.lastName || '',
      mobileNumber: saved.mobileNumber || '',
      addressLine1: saved.addressLine1 || '',
      addressLine2: saved.addressLine2 || '',
      city: saved.city || '',
      state: saved.state || '',
      postalCode: saved.postalCode || '',
    }
    activeOrderModalTab.value = 'order'
    showToast('Customer added successfully!', 'success')
  } catch (err) {
    showToast((err as any)?.response?.data?.message || 'Incorrect or expired OTP. Please try again.', 'error')
  } finally {
    verifyingOtp.value = false
  }
}

async function handleNewOrderClick() {
  const activeSession = await getActiveCashBoxSession();
  if (!activeSession) {
    showToast('No active cash box session. Please open one first.', 'warning');
    return;
  }
  showForm.value = true;
  editOrderId.value = null;
  resetForm();
}

async function handleAddOrder() {
  await handleNewOrderClick();
}
</script>

<style scoped>
.order-discount-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  gap: 12px;
}

/* Sort icon always on the right of the column title */
:deep(.v-data-table-header__content) {
  flex-direction: row-reverse;
  justify-content: flex-end;
  gap: 4px;
}

/* Always show the sort icon on sortable columns (not just on hover) */
:deep(.v-data-table__th--sortable .v-data-table-header__sort-icon) {
  opacity: 0.38;
}
:deep(.v-data-table__th--sorted .v-data-table-header__sort-icon) {
  opacity: 1;
}
</style>
