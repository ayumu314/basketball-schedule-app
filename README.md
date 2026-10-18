HTML／CSS／JavaScriptとFirebaseを使用し、バスケットボールの予定を管理できるWebアプリを制作しました。
https://ayumu314.github.io/basketball-schedule-app/
【主な機能】
・Googleアカウントでのログイン／ログアウト
・予定の追加、編集、削除
・参加予定の切り替え
・日付、地域、募集状況による絞り込み
・キーワード検索、並び替え
・ダークモード
・PC／スマートフォン対応
・同一Googleアカウントでの端末間データ同期

【使用技術】
HTML／CSS／JavaScript
Firebase Authentication
Cloud Firestore
Git／GitHub
GitHub Pages

【工夫した点】
Firebase Authenticationで取得したUIDごとに予定データを分離し、Firestore Security Rulesでも本人のデータのみ読み書きできるようにしました。

また、FirestoreのonSnapshotを利用し、データ更新時に画面へリアルタイム反映される構成にしています。

PC・スマートフォンの実機で、Googleログイン、予定の追加・編集・削除、別アカウントとのデータ分離、端末間同期まで動作確認済みです。
