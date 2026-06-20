<script setup>
import TaskReport from './TaskReport.vue'

defineProps({
  state: {
    type: Object,
    required: true
  }
})

defineEmits(['navigate'])
</script>

<template>
  <section class="wizard panel">
    <div v-if="state.isProcessing" class="processing-bar">
      <span></span>
      <strong>{{ state.processingAction }}</strong>
    </div>
    <header class="wizard-head">
      <div>
        <span>{{ state.activeTask.date }} · {{ state.activeTask.time }}</span>
        <h2>{{ state.activeClass.name }} · {{ state.activeCourse.title }}</h2>
      </div>
      <button class="ghost" @click="state.showReport = !state.showReport">{{ state.showReport ? '继续编辑' : '查看报告' }}</button>
    </header>

    <TaskReport
      v-if="state.showReport"
      :counts="state.counts"
      :report-pulse="state.reportPulse"
      @show-archives="$emit('navigate', 'archives')"
      @show-students="$emit('navigate', 'students')"
    />

    <template v-else>
      <nav class="stepper">
        <button
          v-for="(step, index) in state.steps"
          :key="step.title"
          :class="{ active: state.currentStep === index, finished: step.done === step.total }"
          @click="state.currentStep = index"
        >
          <b>{{ index + 1 }}</b>
          <span>
            <strong>{{ step.title }}</strong>
            <small>{{ step.done }}/{{ step.total }} · {{ step.hint }}</small>
          </span>
        </button>
      </nav>

      <section v-if="state.currentStep === 0" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 1 步</span>
            <strong>确认课次、学生和出勤</strong>
          </div>
          <button class="secondary">从课表刷新</button>
        </div>
        <div class="context-grid">
          <article>
            <span>班级</span>
            <strong>{{ state.activeClass.name }}</strong>
            <small>{{ state.activeClass.time }} · {{ state.activeClass.teacher }}</small>
          </article>
          <article>
            <span>课程</span>
            <strong>{{ state.activeCourse.title }}</strong>
            <small>{{ state.activeCourse.goal }}</small>
          </article>
          <article>
            <span>分发群</span>
            <strong>{{ state.activeClass.group }}</strong>
            <small>{{ state.activeClass.internalGroup }}</small>
          </article>
        </div>
        <div class="roster-table">
          <button
            v-for="row in state.sessionStudents"
            :key="row.id"
            :class="{ active: row.id === state.activeStudentId, absent: row.attendance !== '到课' }"
            @click="state.activeStudentId = row.id"
          >
            <strong>{{ state.students.find((item) => item.id === row.id).name }}</strong>
            <span>{{ state.students.find((item) => item.id === row.id).parent }}</span>
            <em>{{ row.attendance }}</em>
          </button>
        </div>
      </section>

      <section v-if="state.currentStep === 1" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 2 步</span>
            <strong>上传并匹配全班作品</strong>
          </div>
          <button class="primary" :disabled="state.isProcessing" @click="state.matchImages">模拟批量匹配</button>
        </div>
        <div class="works-grid">
          <article
            v-for="row in state.sessionStudents"
            :key="row.id"
            :class="{ absent: row.attendance !== '到课' }"
            class="work-card"
          >
            <img :src="row.image" :alt="state.students.find((item) => item.id === row.id).name" />
            <strong>{{ state.students.find((item) => item.id === row.id).name }}</strong>
            <small>{{ row.attendance === '到课' ? state.fileNameFor(row) : '本节课请假，不生成交付' }}</small>
            <label v-if="row.attendance === '到课'" class="file-button">
              替换作品
              <input type="file" accept="image/*" @change="state.updateImage($event, row)" />
            </label>
            <em>{{ row.imageMatched ? '已匹配' : '缺作品' }}</em>
          </article>
        </div>
      </section>

      <section v-if="state.currentStep === 2" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 3 步</span>
            <strong>录入课堂记录</strong>
          </div>
          <button class="secondary" :disabled="state.isProcessing" @click="state.simulateVoice">模拟语音识别</button>
        </div>
        <div class="record-layout">
          <article>
            <label>
              批量记录
              <textarea v-model="state.bulkRecord" rows="12" />
            </label>
            <button class="primary" @click="state.parseBulkRecord">解析到学生</button>
          </article>
          <article class="record-table">
            <label v-for="row in state.attendingRows" :key="row.id">
              {{ state.students.find((item) => item.id === row.id).name }}
              <input v-model="row.record" />
            </label>
          </article>
        </div>
      </section>

      <section v-if="state.currentStep === 3" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 4 步</span>
            <strong>批量处理图片并生成课评</strong>
          </div>
          <div class="button-pair">
            <button class="secondary" :disabled="state.isProcessing" @click="state.processImages">套用图片模板</button>
            <button class="primary" :disabled="state.isProcessing" @click="state.generateAll">生成全班课评</button>
          </div>
        </div>
        <div class="generate-layout">
          <article class="template-picker">
            <div class="mini-head">
              <span>图片模板</span>
              <strong>{{ state.activeImageTemplate.name }}</strong>
            </div>
            <button
              v-for="(template, index) in state.templates.image"
              :key="template.name"
              :class="{ selected: state.selectedImageTemplate === index }"
              @click="state.chooseImageTemplate(index)"
            >
              <strong>{{ template.name }}</strong>
              <span>{{ template.ratio }} · {{ template.brightness }}</span>
              <small>{{ template.border }} · {{ template.watermark }}</small>
            </button>
          </article>
          <article class="template-picker">
            <div class="mini-head">
              <span>课评模板</span>
              <strong>{{ state.activeCommentTemplate.name }}</strong>
            </div>
            <button
              v-for="(template, index) in state.templates.comment"
              :key="template.name"
              :class="{ selected: state.selectedCommentTemplate === index }"
              @click="state.chooseCommentTemplate(index)"
            >
              <strong>{{ template.name }}</strong>
              <span>{{ template.tone }} · {{ template.length }}</span>
              <small>{{ template.rule }}</small>
            </button>
          </article>
          <article class="comment-editor">
            <div class="student-tabs">
              <button
                v-for="row in state.attendingRows"
                :key="row.id"
                :class="{ selected: row.id === state.activeStudentId }"
                @click="state.activeStudentId = row.id"
              >
                {{ state.students.find((item) => item.id === row.id).name }}
              </button>
            </div>
            <label>
              当前学生课评
              <textarea v-model="state.activeSessionStudent.comment" rows="7" />
            </label>
            <button
              class="secondary"
              :disabled="state.isProcessing"
              @click="state.generateOne(state.activeSessionStudent); state.pulseComment(); state.notify('已重写当前学生课评')"
            >
              重写当前学生
            </button>
          </article>
        </div>
      </section>

      <section v-if="state.currentStep === 4" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 5 步</span>
            <strong>审核、分发并归档</strong>
          </div>
          <button class="primary" :disabled="state.isProcessing" @click="state.archiveAll">一键分发并归档</button>
        </div>
        <div class="delivery-layout">
          <article class="checklist">
            <strong>发送前检查</strong>
            <span v-if="!state.currentWarnings.length" class="ok-text">全部学生材料已准备完成</span>
            <small v-for="warning in state.currentWarnings" :key="warning">{{ warning }}</small>
            <button class="secondary" @click="state.confirmAll">确认全部课评</button>
          </article>
          <article class="channel-stack">
            <div v-for="channel in state.channels" :key="channel.id" :class="{ disabled: channel.status === '待授权' }">
              <strong>{{ channel.name }}</strong>
              <span>{{ channel.type }} · {{ channel.status }}</span>
              <small>{{ channel.risk }}</small>
            </div>
          </article>
        </div>
      </section>

      <footer class="wizard-actions">
        <button class="ghost" :disabled="state.currentStep === 0" @click="state.prevStep">上一步</button>
        <button v-if="state.currentStep < state.steps.length - 1" class="primary" @click="state.nextStep">下一步</button>
        <button v-else class="primary" :disabled="state.isProcessing" @click="state.archiveAll">完成本班交付</button>
      </footer>
    </template>
  </section>
</template>
