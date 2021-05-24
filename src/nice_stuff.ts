import * as $ from "jquery";

export const spinner =
  $(`<svg style="margin: auto; background: #fff; display: block" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid">
<rect x="19" y="19" width="20" height="20" fill="#ffffff">
  <animate
    attributeName="fill"
    values="#000000;#ffffff;#ffffff"
    keyTimes="0;0.125;1"
    dur="0.7352941176470588s"
    repeatCount="indefinite"
    begin="0s"
    calcMode="discrete"
  ></animate>
</rect>
<rect x="40" y="19" width="20" height="20" fill="#ffffff">
  <animate
    attributeName="fill"
    values="#000000;#ffffff;#ffffff"
    keyTimes="0;0.125;1"
    dur="0.7352941176470588s"
    repeatCount="indefinite"
    begin="0.09191176470588235s"
    calcMode="discrete"
  ></animate>
</rect>
<rect x="61" y="19" width="20" height="20" fill="#ffffff">
  <animate
    attributeName="fill"
    values="#000000;#ffffff;#ffffff"
    keyTimes="0;0.125;1"
    dur="0.7352941176470588s"
    repeatCount="indefinite"
    begin="0.1838235294117647s"
    calcMode="discrete"
  ></animate>
</rect>
<rect x="19" y="40" width="20" height="20" fill="#ffffff">
  <animate
    attributeName="fill"
    values="#000000;#ffffff;#ffffff"
    keyTimes="0;0.125;1"
    dur="0.7352941176470588s"
    repeatCount="indefinite"
    begin="0.6433823529411764s"
    calcMode="discrete"
  ></animate>
</rect>
<rect x="61" y="40" width="20" height="20" fill="#ffffff">
  <animate
    attributeName="fill"
    values="#000000;#ffffff;#ffffff"
    keyTimes="0;0.125;1"
    dur="0.7352941176470588s"
    repeatCount="indefinite"
    begin="0.275735294117647s"
    calcMode="discrete"
  ></animate>
</rect>
<rect x="19" y="61" width="20" height="20" fill="#ffffff">
  <animate
    attributeName="fill"
    values="#000000;#ffffff;#ffffff"
    keyTimes="0;0.125;1"
    dur="0.7352941176470588s"
    repeatCount="indefinite"
    begin="0.551470588235294s"
    calcMode="discrete"
  ></animate>
</rect>
<rect x="40" y="61" width="20" height="20" fill="#ffffff">
  <animate
    attributeName="fill"
    values="#000000;#ffffff;#ffffff"
    keyTimes="0;0.125;1"
    dur="0.7352941176470588s"
    repeatCount="indefinite"
    begin="0.45955882352941174s"
    calcMode="discrete"
  ></animate>
</rect>
<rect x="61" y="61" width="20" height="20" fill="#ffffff">
  <animate
    attributeName="fill"
    values="#000000;#ffffff;#ffffff"
    keyTimes="0;0.125;1"
    dur="0.7352941176470588s"
    repeatCount="indefinite"
    begin="0.3676470588235294s"
    calcMode="discrete"
  ></animate>
</rect></svg>`);
