<template>
  <AposModal
    class="apos-import"
    :modal="modal"
    @show-modal="modal.showModal = true"
  >
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <AposLogoIcon
            class="apos-confirm__logo"
          />
          <h2
            v-if="title"
            class="apos-import__heading"
          >
            {{ $t(title, { type: labels.plural }) }}
          </h2>
          <p
            v-if="description"
            class="apos-import__description"
          >
            {{ $t(description) }}
          </p>
          <AposFile
            allowed-extensions=".csv"
            @upload-file="uploadImportFile"
            @update="updateImportFile"
          />
          <div class="apos-confirm__btns">
            <AposButton
              class="apos-confirm__btn"
              label="apostrophe:cancel"
              @click="cancel"
            />
            <AposButton
              ref="confirm"
              class="apos-confirm__btn"
              :label="confirmationButton"
              :type="'primary'"
              :disabled="!selectedFile"
              @click="runImport"
            />
          </div>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
export default {
  props: {
    action: {
      type: String,
      required: true
    },
    route: {
      type: String,
      required: true
    },
    title: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      default: ''
    },
    confirmationButton: {
      type: String,
      default: 'Import'
    },
    labels: {
      type: Object,
      required: true
    }
  },
  data () {
    return {
      modal: {
        title: '',
        active: false,
        type: 'overlay',
        showModal: false,
        disableHeader: true,
        trapFocus: true
      },
      selectedFile: null
    };
  },
  mounted() {
    this.modal.active = true;
  },
  methods: {
    uploadImportFile ([ file ]) {
      this.selectedFile = file || null;
    },
    updateImportFile ([ file ]) {
      this.this.selectedFile = file || null;
    },
    cancel () {
      this.modal.active = false;
    },
    async runImport () {
      try {
        const formData = new FormData();
        formData.append('file', this.selectedFile);

        await apos.http.post(`${this.moduleOptions.action}${this.route}`, {
          body: formData
        });
      } catch (error) {
        apos.notify('Import failed.', {
          type: 'danger'
        });
      } finally {
        this.selectedFile = null;
      }
    }
  }
};
</script>

<style scoped lang='scss'>
.apos-import {
  z-index: $z-index-modal;
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

::v-deep .apos-modal__inner {
  top: auto;
  right: auto;
  bottom: auto;
  left: auto;
  max-width: 700px;
  height: auto;
  text-align: center;
}

::v-deep .apos-modal__body-main {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.apos-confirm__logo {
  height: 35px;
  margin-bottom: $spacing-double;
}

.apos-import__heading {
  @include type-title;
  line-height: var(--a-line-tall);
  margin: 0;
}

.apos-import__description {
  @include type-base;
  max-width: 370px;
  line-height: var(--a-line-tallest);
}
</style>
