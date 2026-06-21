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
        <span>{{ state.activeTask.date }} · {{ state.activeTask.time }} · {{ state.activeTask.lessonType }}</span>
        <h2>{{ state.activeClass.name }} · {{ state.activeCourse.title }}</h2>
      </div>
      <div class="lesson-status">
        <span>当前课次进度</span>
        <strong>{{ state.taskProgress }}%</strong>
        <div class="progress-track slim">
          <i :style="{ width: `${state.taskProgress}%` }"></i>
        </div>
        <small>{{ state.steps.filter((step) => step.done === step.total && step.total > 0).length }}/{{ state.steps.length }} 步完成</small>
      </div>
      <button class="ghost" @click="state.showReport = !state.showReport">{{ state.showReport ? '继续编辑' : '查看报告' }}</button>
    </header>

    <TaskReport
      v-if="state.showReport"
      :counts="state.counts"
      :report-pulse="state.reportPulse"
      :active-task="state.activeTask"
      @show-archives="$emit('navigate', 'archives')"
      @show-students="$emit('navigate', 'students')"
      @show-wheat="$emit('navigate', 'wheat')"
    />

    <template v-else>
      <nav class="stepper">
        <button
          v-for="(step, index) in state.steps"
          :key="step.title"
          :class="{ active: state.currentStep === index, finished: step.done === step.total && step.total > 0 }"
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
            <strong>确认课次、学生、范画和课次类型</strong>
          </div>
          <button class="secondary">从小麦导入记录刷新</button>
        </div>
        <div class="context-grid">
          <article>
            <span>课次来源</span>
            <strong>{{ state.activeTask.importedFrom }}</strong>
            <small>仅作为旁路课后交付数据，不回写小麦</small>
          </article>
          <article>
            <span>课次类型</span>
            <strong>{{ state.activeTask.lessonType }}</strong>
            <small>家长页会展示免责声明</small>
          </article>
          <article>
            <span>课程参考</span>
            <strong>{{ state.activeCourse.goal }}</strong>
            <small>{{ state.activeCourse.materials }}</small>
          </article>
        </div>
        <div class="material-strip">
          <article v-for="material in state.materials" :key="material.id" :class="{ hidden: !material.visible }">
            <img :src="material.image" :alt="material.title" />
            <div>
              <strong>{{ material.type }} · {{ material.title }}</strong>
              <small>{{ material.visible ? '会出现在家长展示页' : '仅内部归档' }}</small>
            </div>
            <button class="ghost" @click="state.toggleMaterialVisible(material)">{{ material.visible ? '隐藏' : '展示' }}</button>
          </article>
          <button class="add-tile" @click="state.addMaterial">补充步骤图</button>
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
            <select :value="row.attendance" @change="state.setAttendance(row, $event.target.value)" @click.stop>
              <option>到课</option>
              <option>请假</option>
              <option>旷课</option>
            </select>
          </button>
        </div>
      </section>

      <section v-if="state.currentStep === 1" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 2 步</span>
            <strong>上传、匹配并确认全班作品</strong>
          </div>
          <div class="button-pair">
            <button class="secondary" :disabled="state.isProcessing" @click="state.matchImages">批量匹配</button>
            <button class="primary" @click="state.confirmImages">确认图片</button>
          </div>
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
            <small>{{ row.attendance === '到课' ? state.fileNameFor(row) : '本节课未到课，不生成交付' }}</small>
            <label v-if="row.attendance === '到课'" class="file-button">
              替换作品
              <input type="file" accept="image/*" @change="state.updateImage($event, row)" />
            </label>
            <em>{{ row.imageConfirmed ? '已确认' : row.imageMatched ? '待确认' : '缺作品' }}</em>
          </article>
        </div>
      </section>

      <section v-if="state.currentStep === 2" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 3 步</span>
            <strong>录入课堂记录和个性化关键词</strong>
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
              {{ state.students.find((item) => item.id === row.id).name }} · 关注点
              <select v-model="row.focus">
                <option>色彩</option>
                <option>想象力</option>
                <option>构图</option>
                <option>细节</option>
              </select>
              <input v-model="row.record" />
            </label>
          </article>
        </div>
      </section>

      <section v-if="state.currentStep === 3" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 4 步</span>
            <strong>处理图片、生成课评并人工确认</strong>
          </div>
          <div class="button-pair">
            <button class="secondary" :disabled="state.isProcessing" @click="state.processImages">AI 图片处理</button>
            <button class="secondary" :disabled="state.isProcessing" @click="state.confirmImages">确认处理图</button>
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
            <div class="image-review" v-if="state.activeSessionStudent">
              <div>
                <span>原图</span>
                <img :src="state.activeSessionStudent.originalImage || state.activeSessionStudent.image" alt="原图" />
              </div>
              <div>
                <span>处理图</span>
                <img :src="state.activeSessionStudent.processedImage || state.activeSessionStudent.image" alt="处理图" />
              </div>
              <article>
                <strong>{{ state.activeSessionStudent.imageProcessStatus }}</strong>
                <small v-if="state.activeSessionStudent.imageProcessError">{{ state.activeSessionStudent.imageProcessError }}</small>
                <small v-else>{{ state.activeSessionStudent.processedImage ? '处理图已生成，需老师确认后进入展示页。' : '尚未生成处理图，家长页仍使用原图。' }}</small>
                <div class="button-pair">
                  <button class="ghost" @click="state.failCurrentImageProcess">模拟失败</button>
                  <button class="secondary" :disabled="state.isProcessing" @click="state.retryCurrentImageProcess">重试当前图片</button>
                </div>
              </article>
            </div>
            <div class="button-pair">
              <button
                class="secondary"
                :disabled="state.isProcessing"
                @click="state.generateOne(state.activeSessionStudent); state.pulseComment(); state.notify('已重写当前学生课评')"
              >
                重写当前学生
              </button>
              <button class="primary" @click="state.confirmAll">确认全部课评</button>
            </div>
          </article>
          <article class="ai-log-panel">
            <div class="mini-head">
              <span>AI 调用记录</span>
              <strong>{{ state.aiCallLogs.length }} 条</strong>
            </div>
            <div v-for="log in state.aiCallLogs.slice(0, 6)" :key="log.id" class="ai-log-row" :class="log.status">
              <strong>{{ log.type }} · {{ log.target }}</strong>
              <span>{{ log.status }} · 重试 {{ log.retry }} · 成本 {{ log.cost }}</span>
              <small>{{ log.time }} · {{ log.message }}</small>
            </div>
          </article>
        </div>
      </section>

      <section v-if="state.currentStep === 4" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 5 步</span>
            <strong>配置家长展示页、课后任务和高光作品</strong>
          </div>
          <button class="primary" :disabled="state.isProcessing" @click="state.generateSharePages">生成链接/二维码</button>
        </div>
        <div class="parent-layout">
          <article class="record-table">
            <label>
              课后任务
              <textarea v-model="state.homework.content" rows="4" />
            </label>
            <label>
              交付要求
              <input v-model="state.homework.requirement" />
            </label>
            <label>
              预计回收
              <input v-model="state.homework.dueDate" />
            </label>
            <div class="switch-row">
              <label><input v-model="state.displayConfig.showMaterials" type="checkbox" /> 展示范画步骤</label>
              <label><input v-model="state.displayConfig.showHomework" type="checkbox" /> 展示课后任务</label>
              <label><input v-model="state.displayConfig.showHighlight" type="checkbox" /> 展示高光说明</label>
              <label><input v-model="state.displayConfig.showLessonType" type="checkbox" /> 展示课次类型</label>
              <label><input v-model="state.displayConfig.allowForward" type="checkbox" /> 允许转发继续访问</label>
            </div>
            <label>
              访问策略
              <select v-model="state.displayConfig.accessPolicy">
                <option>链接密钥访问</option>
                <option>密码访问</option>
                <option>公开访问</option>
              </select>
            </label>
            <label>
              有效期（天）
              <input v-model.number="state.displayConfig.expiresInDays" type="number" />
            </label>
            <small>当前到期时间：{{ state.displayConfig.expiresAt }} · {{ state.displayConfig.publicStatus }}</small>
          </article>
          <article class="record-table">
            <strong>外部在线课程链接</strong>
            <label v-for="link in state.externalLinks" :key="link.id" class="inline-check">
              <input
                type="checkbox"
                :checked="state.homework.externalLinkIds.includes(link.id)"
                @change="state.toggleHomeworkLink(link.id)"
              />
              <span>{{ link.title }} · {{ link.note }}</span>
            </label>
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
            <label class="inline-check">
              <input type="checkbox" :checked="state.activeSessionStudent.highlight" @change="state.toggleHighlight(state.activeSessionStudent)" />
              <span>标记当前学生作品为高光</span>
            </label>
            <label>
              高光说明
              <textarea v-model="state.activeSessionStudent.highlightNote" rows="4" />
            </label>
          </article>
        </div>
      </section>

      <section v-if="state.currentStep === 5" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 6 步</span>
            <strong>发送前检查、归档并生成小麦留痕</strong>
          </div>
          <button class="primary" :disabled="state.isProcessing || state.currentWarnings.length" @click="state.archiveAll">
            完成本班交付
          </button>
        </div>
        <div class="delivery-layout">
          <article class="checklist">
            <strong>发送前检查</strong>
            <span v-if="!state.currentWarnings.length" class="ok-text">全部学生材料、展示页和任务已准备完成</span>
            <small v-for="warning in state.currentWarnings" :key="warning">{{ warning }}</small>
            <div class="button-pair">
              <button class="secondary" @click="state.confirmImages">确认全部图片</button>
              <button class="secondary" @click="state.confirmAll">确认全部课评</button>
              <button class="secondary" @click="state.generateSharePages">补生成展示页</button>
            </div>
          </article>
          <article class="channel-stack">
            <div>
              <strong>家长展示页</strong>
              <span>{{ state.counts.shareReady }}/{{ state.counts.attend }} 已生成</span>
              <small>复制链接或二维码后，由老师人工发送给家长</small>
            </div>
            <div>
              <strong>系统作品档案</strong>
              <span>{{ state.counts.archived }}/{{ state.counts.attend }} 已归档</span>
              <small>保存作品、课评、高光、范画、课后任务和展示配置</small>
            </div>
            <div>
              <strong>小麦留痕待办</strong>
              <span>{{ state.activeTask.wheatStatus }}</span>
              <small>归档后生成待办，教务回小麦人工处理后再标记</small>
            </div>
          </article>
        </div>
      </section>

      <footer class="wizard-actions">
        <button class="ghost" :disabled="state.currentStep === 0" @click="state.prevStep">上一步</button>
        <button v-if="state.currentStep < state.steps.length - 1" class="primary" @click="state.nextStep">下一步</button>
        <button v-else class="primary" :disabled="state.isProcessing || state.currentWarnings.length" @click="state.archiveAll">完成本班交付</button>
      </footer>
    </template>
  </section>
</template>
